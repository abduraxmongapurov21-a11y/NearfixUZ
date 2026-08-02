import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { AdminAccountRole, AdminAccountStatus, UserRole } from "@prisma/client";
import { env } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { createAccessToken } from "../src/modules/auth/session.js";

const usernames = [
  "mgmt-env-created",
  "mgmt-super",
  "mgmt-super-created",
  "mgmt-regular-no-manage",
  "mgmt-regular-manage",
  "mgmt-regular-target",
  "mgmt-disabled-target"
];
const mobilePhone = "+998991119915";

async function cleanup() {
  const admins = await prisma.adminAccount.findMany({
    where: {
      username: { in: usernames }
    },
    select: { id: true }
  });

  await prisma.adminAuditLog.deleteMany({
    where: {
      OR: [
        { actorAdminId: { in: admins.map((admin) => admin.id) } },
        { targetId: { in: admins.map((admin) => admin.id) } }
      ]
    }
  });
  await prisma.adminAccount.deleteMany({
    where: {
      username: { in: usernames }
    }
  });
  await prisma.user.deleteMany({
    where: { phone: mobilePhone }
  });
}

async function main() {
  await cleanup();

  const [superHash, noManageHash, manageHash] = await Promise.all([
    hashPassword("SuperAdminPassword-123"),
    hashPassword("NoManagePassword-123"),
    hashPassword("ManageAdminPassword-123")
  ]);

  await prisma.adminAccount.create({
    data: {
      username: "mgmt-super",
      passwordHash: superHash,
      role: AdminAccountRole.SUPER_ADMIN,
      status: AdminAccountStatus.ACTIVE,
      mustChangePassword: false
    }
  });
  await prisma.adminAccount.create({
    data: {
      username: "mgmt-regular-no-manage",
      passwordHash: noManageHash,
      role: AdminAccountRole.ADMIN,
      status: AdminAccountStatus.ACTIVE,
      mustChangePassword: false,
      permissions: {
        create: [{ permission: "analytics.read" }]
      }
    }
  });
  await prisma.adminAccount.create({
    data: {
      username: "mgmt-regular-manage",
      passwordHash: manageHash,
      role: AdminAccountRole.ADMIN,
      status: AdminAccountStatus.ACTIVE,
      mustChangePassword: false,
      permissions: {
        create: [{ permission: "admins.manage" }, { permission: "analytics.read" }]
      }
    }
  });

  const mobileUser = await prisma.user.create({
    data: {
      phone: mobilePhone,
      role: UserRole.CLIENT
    }
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
    const superToken = await login("mgmt-super", "SuperAdminPassword-123");
    const noManageToken = await login("mgmt-regular-no-manage", "NoManagePassword-123");
    const manageToken = await login("mgmt-regular-manage", "ManageAdminPassword-123");

    const userCountBefore = await prisma.user.count();
    const envCreate = await request("POST", "/admin/admins", envToken, {
      username: "mgmt-env-created",
      password: "EnvCreatedPassword-123",
      name: "Env Created",
      permissions: ["analytics.read"],
      mustChangePassword: true
    });
    assert.equal(envCreate.response.status, 201);
    assert.equal(envCreate.payload.admin.username, "mgmt-env-created");
    assert.equal(envCreate.payload.admin.passwordHash, undefined);
    assert.equal(await prisma.user.count(), userCountBefore, "admin create must not touch User table");

    const storedEnvCreated = await prisma.adminAccount.findUniqueOrThrow({
      where: { username: "mgmt-env-created" }
    });
    assert.notEqual(storedEnvCreated.passwordHash, "EnvCreatedPassword-123");

    const superCreate = await request("POST", "/admin/admins", superToken, {
      username: "mgmt-super-created",
      password: "SuperCreatedPassword-123",
      role: "SUPER_ADMIN",
      mustChangePassword: false
    });
    assert.equal(superCreate.response.status, 201);
    assert.equal(superCreate.payload.admin.role, "super_admin");

    const noManageCreate = await request("POST", "/admin/admins", noManageToken, {
      username: "should-not-create",
      password: "ShouldNotCreate-123"
    });
    assert.equal(noManageCreate.response.status, 403);

    const manageCreateSuper = await request("POST", "/admin/admins", manageToken, {
      username: "should-not-super",
      password: "ShouldNotSuper-123",
      role: "SUPER_ADMIN"
    });
    assert.equal(manageCreateSuper.response.status, 403);

    const manageCreateForbiddenPermission = await request("POST", "/admin/admins", manageToken, {
      username: "should-not-grant-super",
      password: "ShouldNotGrant-123",
      permissions: ["super_admin.manage"]
    });
    assert.equal(manageCreateForbiddenPermission.response.status, 403);

    const duplicate = await request("POST", "/admin/admins", envToken, {
      username: "mgmt-env-created",
      password: "DuplicatePassword-123"
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.payload.code, "ADMIN_USERNAME_EXISTS");

    const target = await prisma.adminAccount.create({
      data: {
        username: "mgmt-regular-target",
        passwordHash: await hashPassword("TargetPassword-123"),
        role: AdminAccountRole.ADMIN,
        status: AdminAccountStatus.ACTIVE,
        mustChangePassword: false
      }
    });
    const beforePasswordReset = target.sessionVersion;
    const passwordReset = await request("PATCH", `/admin/admins/${target.id}/password`, envToken, {
      password: "ResetPassword-123",
      mustChangePassword: true
    });
    assert.equal(passwordReset.response.status, 200);
    const afterPasswordReset = await prisma.adminAccount.findUniqueOrThrow({ where: { id: target.id } });
    assert.equal(afterPasswordReset.sessionVersion, beforePasswordReset + 1);

    const beforePermissionUpdate = afterPasswordReset.sessionVersion;
    const permissionUpdate = await request("PATCH", `/admin/admins/${target.id}/permissions`, envToken, {
      permissions: ["analytics.read", "admins.read"]
    });
    assert.equal(permissionUpdate.response.status, 200);
    const afterPermissionUpdate = await prisma.adminAccount.findUniqueOrThrow({ where: { id: target.id } });
    assert.equal(afterPermissionUpdate.sessionVersion, beforePermissionUpdate + 1);

    const disabledTarget = await prisma.adminAccount.create({
      data: {
        username: "mgmt-disabled-target",
        passwordHash: await hashPassword("DisableTarget-123"),
        role: AdminAccountRole.ADMIN,
        status: AdminAccountStatus.ACTIVE,
        mustChangePassword: false
      }
    });
    const disable = await request("PATCH", `/admin/admins/${disabledTarget.id}/disable`, envToken);
    assert.equal(disable.response.status, 200);
    const disabledLogin = await request("POST", "/admin/auth/login", undefined, {
      username: "mgmt-disabled-target",
      password: "DisableTarget-123"
    });
    assert.equal(disabledLogin.response.status, 403);
    assert.equal(disabledLogin.payload.code, "ADMIN_DISABLED");

    const mobileToken = createAccessToken({
      userId: mobileUser.id,
      sessionId: "mobile-session",
      sessionVersion: mobileUser.sessionVersion
    });
    const mobileAdmins = await request("GET", "/admin/admins", mobileToken);
    assert.equal(mobileAdmins.response.status, 401);
    assert.equal(mobileAdmins.payload.code, "ADMIN_UNAUTHORIZED");

    const auditCount = await prisma.adminAuditLog.count({
      where: {
        action: {
          in: [
            "admin.created",
            "admin.password_reset",
            "admin.permissions_updated",
            "admin.disabled"
          ]
        }
      }
    });
    assert.ok(auditCount >= 5);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("Admin management tests passed");
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
