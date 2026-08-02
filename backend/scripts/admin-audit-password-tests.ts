import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { AdminAccountRole, AdminAccountStatus, UserRole } from "@prisma/client";
import { env } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { writeAdminAuditLog } from "../src/modules/admin-auth/admin-audit.service.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { createAccessToken } from "../src/modules/auth/session.js";

const usernames = [
  "audit-reader",
  "audit-no-read",
  "audit-must-change",
  "audit-created",
  "audit-target"
];
const mobilePhone = "+998991119916";

async function cleanup() {
  const admins = await prisma.adminAccount.findMany({
    where: { username: { in: usernames } },
    select: { id: true }
  });

  await prisma.adminAuditLog.deleteMany({
    where: {
      OR: [
        { actorAdminId: { in: admins.map((admin) => admin.id) } },
        { targetId: { in: admins.map((admin) => admin.id) } },
        { action: { startsWith: "audit-test." } },
        { action: { in: ["admin.created", "admin.updated", "admin.disabled", "admin.enabled", "admin.password_reset", "admin.password_changed"] } }
      ]
    }
  });
  await prisma.adminAccount.deleteMany({ where: { username: { in: usernames } } });
  await prisma.user.deleteMany({ where: { phone: mobilePhone } });
}

async function main() {
  await cleanup();

  await prisma.adminAccount.create({
    data: {
      username: "audit-reader",
      passwordHash: await hashPassword("AuditReaderPassword-123"),
      role: AdminAccountRole.ADMIN,
      status: AdminAccountStatus.ACTIVE,
      mustChangePassword: false,
      permissions: { create: [{ permission: "audit.read" }] }
    }
  });
  await prisma.adminAccount.create({
    data: {
      username: "audit-no-read",
      passwordHash: await hashPassword("AuditNoReadPassword-123"),
      role: AdminAccountRole.ADMIN,
      status: AdminAccountStatus.ACTIVE,
      mustChangePassword: false,
      permissions: { create: [{ permission: "analytics.read" }] }
    }
  });
  await prisma.adminAccount.create({
    data: {
      username: "audit-must-change",
      passwordHash: await hashPassword("MustChangePassword-123"),
      role: AdminAccountRole.ADMIN,
      status: AdminAccountStatus.ACTIVE,
      mustChangePassword: true,
      permissions: { create: [{ permission: "audit.read" }, { permission: "admins.read" }] }
    }
  });
  const target = await prisma.adminAccount.create({
    data: {
      username: "audit-target",
      passwordHash: await hashPassword("AuditTargetPassword-123"),
      role: AdminAccountRole.ADMIN,
      status: AdminAccountStatus.ACTIVE,
      mustChangePassword: false
    }
  });
  const mobileUser = await prisma.user.create({
    data: { phone: mobilePhone, role: UserRole.CLIENT }
  });

  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(method: string, path: string, token?: string, body?: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  async function login(username: string, password: string) {
    const result = await request("POST", "/admin/auth/login", undefined, { username, password });
    assert.equal(result.response.status, 200);
    return result.payload.token as string;
  }

  try {
    const envToken = await login(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
    const auditReaderToken = await login("audit-reader", "AuditReaderPassword-123");
    const noReadToken = await login("audit-no-read", "AuditNoReadPassword-123");
    const mustChangeToken = await login("audit-must-change", "MustChangePassword-123");

    await writeAdminAuditLog({
      actorType: "ENV_ADMIN",
      action: "audit-test.sanitized",
      targetType: "Test",
      targetId: "secret-test",
      metadata: {
        password: "never-return",
        token: "never-return",
        nested: { authorization: "never-return", ok: true }
      }
    });

    const envLogs = await request("GET", "/admin/audit-logs?action=audit-test.sanitized", envToken);
    assert.equal(envLogs.response.status, 200);
    assert.equal(envLogs.payload.logs[0].metadata.password, "[redacted]");
    assert.equal(envLogs.payload.logs[0].metadata.token, "[redacted]");
    assert.equal(envLogs.payload.logs[0].metadata.nested.authorization, "[redacted]");

    const readerLogs = await request("GET", "/admin/audit-logs", auditReaderToken);
    assert.equal(readerLogs.response.status, 200);

    const forbiddenLogs = await request("GET", "/admin/audit-logs", noReadToken);
    assert.equal(forbiddenLogs.response.status, 403);

    const mobileToken = createAccessToken({
      userId: mobileUser.id,
      sessionId: "mobile-session",
      sessionVersion: mobileUser.sessionVersion
    });
    const mobileLogs = await request("GET", "/admin/audit-logs", mobileToken);
    assert.equal(mobileLogs.response.status, 401);

    const mustChangeMe = await request("GET", "/admin/auth/me", mustChangeToken);
    assert.equal(mustChangeMe.response.status, 200);
    assert.equal(mustChangeMe.payload.user.mustChangePassword, true);

    const mustChangeAuditAccess = await request("GET", "/admin/audit-logs", mustChangeToken);
    assert.equal(mustChangeAuditAccess.response.status, 200);

    const wrongCurrentPassword = await request("POST", "/admin/auth/change-password", mustChangeToken, {
      currentPassword: "WrongPassword-123",
      newPassword: "ChangedAuditPassword-123"
    });
    assert.equal(wrongCurrentPassword.response.status, 400);
    assert.equal(wrongCurrentPassword.payload.code, "INVALID_CURRENT_PASSWORD");

    const changePassword = await request("POST", "/admin/auth/change-password", mustChangeToken, {
      currentPassword: "MustChangePassword-123",
      newPassword: "ChangedAuditPassword-123"
    });
    assert.equal(changePassword.response.status, 200);

    const oldTokenAfterChange = await request("GET", "/admin/auth/me", mustChangeToken);
    assert.equal(oldTokenAfterChange.response.status, 401);

    const changedLoginToken = await login("audit-must-change", "ChangedAuditPassword-123");
    const changedMe = await request("GET", "/admin/auth/me", changedLoginToken);
    assert.equal(changedMe.response.status, 200);
    assert.equal(changedMe.payload.user.mustChangePassword, false);

    const createAdmin = await request("POST", "/admin/admins", envToken, {
      username: "audit-created",
      password: "AuditCreatedPassword-123",
      permissions: ["audit.read"],
      mustChangePassword: false
    });
    assert.equal(createAdmin.response.status, 201);
    const createdId = createAdmin.payload.admin.id as string;

    const updateAdmin = await request("PATCH", `/admin/admins/${createdId}`, envToken, {
      name: "Audit Created",
      status: "ACTIVE"
    });
    assert.equal(updateAdmin.response.status, 200);

    const resetPassword = await request("PATCH", `/admin/admins/${createdId}/password`, envToken, {
      password: "AuditResetPassword-123",
      mustChangePassword: true
    });
    assert.equal(resetPassword.response.status, 200);

    const disableAdmin = await request("PATCH", `/admin/admins/${createdId}/disable`, envToken);
    assert.equal(disableAdmin.response.status, 200);

    const enableAdmin = await request("PATCH", `/admin/admins/${createdId}/enable`, envToken);
    assert.equal(enableAdmin.response.status, 200);

    const auditActions = await prisma.adminAuditLog.findMany({
      where: {
        targetId: { in: [createdId, target.id] },
        action: {
          in: ["admin.created", "admin.updated", "admin.disabled", "admin.enabled", "admin.password_reset"]
        }
      },
      select: { action: true }
    });
    const actionSet = new Set(auditActions.map((item) => item.action));
    assert.ok(actionSet.has("admin.created"));
    assert.ok(actionSet.has("admin.updated"));
    assert.ok(actionSet.has("admin.password_reset"));
    assert.ok(actionSet.has("admin.disabled"));
    assert.ok(actionSet.has("admin.enabled"));

    const passwordChangedCount = await prisma.adminAuditLog.count({
      where: { action: "admin.password_changed" }
    });
    assert.ok(passwordChangedCount >= 1);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("Admin audit and password tests passed");
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
