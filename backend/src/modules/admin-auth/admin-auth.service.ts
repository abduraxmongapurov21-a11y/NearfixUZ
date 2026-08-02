import crypto from "node:crypto";
import { AdminAccountRole, AdminAccountStatus, type AdminAccount } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { hashPassword, isPasswordWithinBcryptLimit, verifyPassword } from "../auth/password.js";
import { ADMIN_PERMISSIONS, type AdminPermission } from "../auth/permissions.js";

const ADMIN_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const ENV_ADMIN_TOKEN_TYPE = "env_admin";
const DB_ADMIN_TOKEN_TYPE = "admin_account";

type EnvAdminTokenPayload = {
  tokenType: typeof ENV_ADMIN_TOKEN_TYPE;
  username: string;
  credentialVersion: string;
  role: "super_admin";
  iat: number;
  exp: number;
};

type DbAdminTokenPayload = {
  tokenType: typeof DB_ADMIN_TOKEN_TYPE;
  adminId: string;
  username: string;
  role: "admin" | "super_admin";
  permissions: AdminPermission[];
  sessionVersion: number;
  iat: number;
  exp: number;
};

type AdminTokenPayload = EnvAdminTokenPayload | DbAdminTokenPayload;

export type AdminContext = {
  actorType: "ENV_ADMIN" | "ADMIN_ACCOUNT";
  adminId?: string;
  id: string;
  sessionId: string;
  phone: string;
  username: string;
  name: string | null;
  role: "admin" | "super_admin";
  permissions: AdminPermission[];
  sessionVersion: number;
  tokenType: typeof ENV_ADMIN_TOKEN_TYPE | typeof DB_ADMIN_TOKEN_TYPE;
  isSuperAdmin: boolean;
  mustChangePassword?: boolean;
};

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(data: string) {
  return crypto.createHmac("sha256", env.ACCESS_TOKEN_SECRET).update(data).digest("base64url");
}

function secureEqual(left: string, right: string) {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function currentCredentialVersion() {
  return crypto
    .createHmac("sha256", env.ACCESS_TOKEN_SECRET)
    .update(`${env.ADMIN_USERNAME}\0${env.ADMIN_PASSWORD}`)
    .digest("base64url");
}

function unauthorized(message = "Invalid admin credentials") {
  return Object.assign(new Error(message), {
    status: 401,
    code: "ADMIN_UNAUTHORIZED"
  });
}

function disabled() {
  return Object.assign(new Error("Admin account is disabled"), {
    status: 403,
    code: "ADMIN_DISABLED"
  });
}

function assertStrongAdminPassword(username: string, password: string) {
  const normalizedPassword = password.toLowerCase();
  const normalizedUsername = username.toLowerCase();
  const trivialPasswords = new Set(["admin321", "password", "password123", "12345678", "1234567890", "qwerty123"]);

  if (password.length < 10 || !isPasswordWithinBcryptLimit(password)) {
    throw Object.assign(new Error("Admin password does not meet security requirements"), {
      status: 400,
      code: "INVALID_ADMIN_PASSWORD"
    });
  }

  if (trivialPasswords.has(normalizedPassword) || normalizedPassword.includes(normalizedUsername)) {
    throw Object.assign(new Error("Admin password is too easy to guess"), {
      status: 400,
      code: "INVALID_ADMIN_PASSWORD"
    });
  }
}

function roleToApi(role: AdminAccountRole): "admin" | "super_admin" {
  return role === AdminAccountRole.SUPER_ADMIN ? "super_admin" : "admin";
}

function permissionsForDbAdmin(admin: AdminAccount & { permissions: { permission: string }[] }): AdminPermission[] {
  if (admin.role === AdminAccountRole.SUPER_ADMIN) return [...ADMIN_PERMISSIONS];

  return admin.permissions
    .map((item) => item.permission)
    .filter((permission): permission is AdminPermission => (ADMIN_PERMISSIONS as readonly string[]).includes(permission))
    .sort();
}

function createSignedToken(payload: AdminTokenPayload) {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const encodedPayload = base64UrlJson(payload);
  const data = `${header}.${encodedPayload}`;

  return `${data}.${sign(data)}`;
}

function createEnvAdminToken(username: string) {
  const now = Math.floor(Date.now() / 1000);

  return createSignedToken({
    tokenType: ENV_ADMIN_TOKEN_TYPE,
    username,
    credentialVersion: currentCredentialVersion(),
    role: "super_admin",
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_SECONDS
  });
}

function createDbAdminToken(admin: AdminAccount & { permissions: { permission: string }[] }) {
  const now = Math.floor(Date.now() / 1000);
  const role = roleToApi(admin.role);
  const permissions = permissionsForDbAdmin(admin);

  return createSignedToken({
    tokenType: DB_ADMIN_TOKEN_TYPE,
    adminId: admin.id,
    username: admin.username,
    role,
    permissions,
    sessionVersion: admin.sessionVersion,
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_SECONDS
  });
}

function decodePayload(token: string): AdminTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Partial<AdminTokenPayload>;
    return payload.tokenType === ENV_ADMIN_TOKEN_TYPE || payload.tokenType === DB_ADMIN_TOKEN_TYPE
      ? payload as AdminTokenPayload
      : null;
  } catch {
    return null;
  }
}

function verifySignature(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw unauthorized("Invalid admin token");

  const data = `${parts[0]}.${parts[1]}`;
  const actualSignature = Buffer.from(parts[2]);
  const expectedSignature = Buffer.from(sign(data));

  if (
    actualSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw unauthorized("Invalid admin token");
  }
}

function assertNotExpired(payload: { exp?: number }) {
  if (!Number.isInteger(payload.exp) || payload.exp! <= Math.floor(Date.now() / 1000)) {
    throw unauthorized("Admin token expired or invalid");
  }
}

export function createEnvAdminUser(username: string): AdminContext {
  return {
    actorType: "ENV_ADMIN",
    id: "env-admin",
    sessionId: "env-admin",
    phone: "",
    username,
    name: username,
    role: "super_admin",
    permissions: [...ADMIN_PERMISSIONS],
    sessionVersion: 1,
    tokenType: ENV_ADMIN_TOKEN_TYPE,
    isSuperAdmin: true
  };
}

function createDbAdminUser(admin: AdminAccount & { permissions: { permission: string }[] }): AdminContext {
  const role = roleToApi(admin.role);

  return {
    actorType: "ADMIN_ACCOUNT",
    adminId: admin.id,
    id: admin.id,
    sessionId: admin.id,
    phone: "",
    username: admin.username,
    name: admin.name,
    role,
    permissions: permissionsForDbAdmin(admin),
    sessionVersion: admin.sessionVersion,
    tokenType: DB_ADMIN_TOKEN_TYPE,
    isSuperAdmin: role === "super_admin",
    mustChangePassword: admin.mustChangePassword
  };
}

export function loginEnvAdmin(input: { username: string; password: string }) {
  const usernameMatches = secureEqual(input.username, env.ADMIN_USERNAME);
  const passwordMatches = secureEqual(input.password, env.ADMIN_PASSWORD);

  if (!usernameMatches || !passwordMatches) {
    throw unauthorized();
  }

  const token = createEnvAdminToken(env.ADMIN_USERNAME);

  return {
    token,
    expiresIn: ADMIN_TOKEN_TTL_SECONDS,
    user: createEnvAdminUser(env.ADMIN_USERNAME)
  };
}

async function findAdminByUsername(username: string) {
  return prisma.adminAccount.findUnique({
    where: { username },
    include: { permissions: true }
  });
}

export async function loginAdmin(input: { username: string; password: string }) {
  const username = input.username.trim();

  try {
    return loginEnvAdmin({ username, password: input.password });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    if (code !== "ADMIN_UNAUTHORIZED") throw error;
  }

  const admin = await findAdminByUsername(username);
  const passwordMatches = await verifyPassword(input.password, admin?.passwordHash);

  if (!admin || !passwordMatches) {
    throw unauthorized();
  }

  if (admin.status === AdminAccountStatus.DISABLED) {
    throw disabled();
  }

  const updatedAdmin = await prisma.adminAccount.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
    include: { permissions: true }
  });
  const token = createDbAdminToken(updatedAdmin);

  return {
    token,
    expiresIn: ADMIN_TOKEN_TTL_SECONDS,
    user: createDbAdminUser(updatedAdmin)
  };
}

export async function changeAdminPassword(
  actor: AdminContext,
  input: { currentPassword: string; newPassword: string }
) {
  if (actor.tokenType !== DB_ADMIN_TOKEN_TYPE || !actor.adminId) {
    throw Object.assign(new Error("Env admin password is managed outside the app"), {
      status: 403,
      code: "ADMIN_ACCOUNT_REQUIRED"
    });
  }

  const admin = await prisma.adminAccount.findUnique({
    where: { id: actor.adminId },
    select: { id: true, username: true, passwordHash: true, status: true }
  });

  if (!admin) throw unauthorized("Admin account no longer exists");
  if (admin.status === AdminAccountStatus.DISABLED) throw disabled();

  const currentPasswordMatches = await verifyPassword(input.currentPassword, admin.passwordHash);
  if (!currentPasswordMatches) {
    throw Object.assign(new Error("Current password is invalid"), {
      status: 400,
      code: "INVALID_CURRENT_PASSWORD"
    });
  }

  assertStrongAdminPassword(admin.username, input.newPassword);

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.adminAccount.update({
    where: { id: admin.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      sessionVersion: { increment: 1 }
    }
  });
}

export async function resolveAdminLoginAuditActor(username: string): Promise<{
  actorType: "ENV_ADMIN" | "ADMIN_ACCOUNT";
  actorAdminId: string | null;
}> {
  const trimmedUsername = username.trim();

  if (trimmedUsername) {
    const admin = await prisma.adminAccount.findUnique({
      where: { username: trimmedUsername },
      select: { id: true }
    });

    if (admin) {
      return {
        actorType: "ADMIN_ACCOUNT",
        actorAdminId: admin.id
      };
    }
  }

  return {
    actorType: "ENV_ADMIN",
    actorAdminId: null
  };
}

export function verifyEnvAdminToken(token: string) {
  const payload = decodePayload(token);
  if (!payload || payload.tokenType !== ENV_ADMIN_TOKEN_TYPE) return null;

  verifySignature(token);
  assertNotExpired(payload);

  if (
    payload.username !== env.ADMIN_USERNAME ||
    !secureEqual(payload.credentialVersion || "", currentCredentialVersion()) ||
    payload.role !== "super_admin"
  ) {
    throw unauthorized("Admin token expired or invalid");
  }

  return createEnvAdminUser(payload.username);
}

export async function verifyDbAdminToken(token: string) {
  const payload = decodePayload(token);
  if (!payload || payload.tokenType !== DB_ADMIN_TOKEN_TYPE) return null;

  verifySignature(token);
  assertNotExpired(payload);

  const admin = await prisma.adminAccount.findUnique({
    where: { id: payload.adminId },
    include: { permissions: true }
  });

  if (!admin) throw unauthorized("Admin account no longer exists");
  if (admin.status === AdminAccountStatus.DISABLED) throw disabled();
  if (payload.sessionVersion !== admin.sessionVersion) throw unauthorized("Admin token expired or invalid");
  if (payload.username !== admin.username || payload.role !== roleToApi(admin.role)) {
    throw unauthorized("Admin token expired or invalid");
  }

  return createDbAdminUser(admin);
}

export async function verifyAdminToken(token: string) {
  const envAdmin = verifyEnvAdminToken(token);
  if (envAdmin) return envAdmin;

  const dbAdmin = await verifyDbAdminToken(token);
  if (dbAdmin) return dbAdmin;

  return null;
}
