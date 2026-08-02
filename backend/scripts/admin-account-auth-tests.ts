import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { AdminAccountRole, AdminAccountStatus, UserRole } from "@prisma/client";
import { env } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { createAccessToken } from "../src/modules/auth/session.js";

const adminUsername = "db-admin-test";
const disabledUsername = "disabled-admin-test";
const adminPassword = "AdminPassword-123";
const disabledPassword = "DisabledPassword-123";
const mobilePhone = "+998991119914";

async function cleanup() {
  const admins = await prisma.adminAccount.findMany({
    where: {
      username: {
        in: [adminUsername, disabledUsername]
      }
    },
    select: { id: true }
  });

  await prisma.adminAuditLog.deleteMany({
    where: {
      OR: [
        { action: { in: ["admin.login_success", "admin.login_failed"] } },
        {
          actorAdminId: {
            in: admins.map((admin) => admin.id)
          }
        }
      ]
    }
  });
  await prisma.adminAccount.deleteMany({
    where: {
      username: {
        in: [adminUsername, disabledUsername]
      }
    }
  });
  await prisma.user.deleteMany({
    where: { phone: mobilePhone }
  });
}

async function main() {
  await cleanup();

  const [adminPasswordHash, disabledPasswordHash] = await Promise.all([
    hashPassword(adminPassword),
    hashPassword(disabledPassword)
  ]);

  const dbAdmin = await prisma.adminAccount.create({
    data: {
      username: adminUsername,
      passwordHash: adminPasswordHash,
      name: "DB Admin Test",
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
      username: disabledUsername,
      passwordHash: disabledPasswordHash,
      name: "Disabled Admin Test",
      role: AdminAccountRole.ADMIN,
      status: AdminAccountStatus.DISABLED,
      mustChangePassword: false
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

  async function post(path: string, body: Record<string, string>) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  async function get(path: string, token?: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  try {
    const envLogin = await post("/admin/auth/login", {
      username: env.ADMIN_USERNAME,
      password: env.ADMIN_PASSWORD
    });
    assert.equal(envLogin.response.status, 200);
    assert.equal(envLogin.payload.user.tokenType, "env_admin");
    assert.equal(envLogin.payload.user.role, "super_admin");

    const envMe = await get("/admin/auth/me", envLogin.payload.token);
    assert.equal(envMe.response.status, 200);
    assert.equal(envMe.payload.user.tokenType, "env_admin");

    const dbLogin = await post("/admin/auth/login", {
      username: adminUsername,
      password: adminPassword
    });
    assert.equal(dbLogin.response.status, 200);
    assert.equal(dbLogin.payload.user.id, dbAdmin.id);
    assert.equal(dbLogin.payload.user.tokenType, "admin_account");
    assert.equal(dbLogin.payload.user.role, "admin");
    assert.deepEqual(dbLogin.payload.user.permissions, ["analytics.read"]);
    assert.equal(dbLogin.payload.user.mustChangePassword, false);

    const dbMe = await get("/admin/auth/me", dbLogin.payload.token);
    assert.equal(dbMe.response.status, 200);
    assert.equal(dbMe.payload.user.tokenType, "admin_account");

    const wrongPassword = await post("/admin/auth/login", {
      username: adminUsername,
      password: "WrongPassword-123"
    });
    assert.equal(wrongPassword.response.status, 401);
    assert.equal(wrongPassword.payload.code, "ADMIN_UNAUTHORIZED");

    const disabledLogin = await post("/admin/auth/login", {
      username: disabledUsername,
      password: disabledPassword
    });
    assert.equal(disabledLogin.response.status, 403);
    assert.equal(disabledLogin.payload.code, "ADMIN_DISABLED");

    const mobileToken = createAccessToken({
      userId: mobileUser.id,
      sessionId: "mobile-session",
      sessionVersion: mobileUser.sessionVersion
    });
    const mobileAdminMe = await get("/admin/auth/me", mobileToken);
    assert.equal(mobileAdminMe.response.status, 401);
    assert.equal(mobileAdminMe.payload.code, "ADMIN_UNAUTHORIZED");

    await prisma.adminAccount.update({
      where: { id: dbAdmin.id },
      data: {
        sessionVersion: {
          increment: 1
        }
      }
    });
    const staleMe = await get("/admin/auth/me", dbLogin.payload.token);
    assert.equal(staleMe.response.status, 401);
    assert.equal(staleMe.payload.code, "ADMIN_UNAUTHORIZED");

    const successCount = await prisma.adminAuditLog.count({
      where: { action: "admin.login_success" }
    });
    const failureCount = await prisma.adminAuditLog.count({
      where: { action: "admin.login_failed" }
    });
    assert.ok(successCount >= 2);
    assert.ok(failureCount >= 2);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanup();
    await prisma.$disconnect();
  }

  console.log("Admin account auth tests passed");
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
