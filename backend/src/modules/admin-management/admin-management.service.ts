import { AdminAccountRole, AdminAccountStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { writeAdminAuditLog } from "../admin-auth/admin-audit.service.js";
import type { AdminContext } from "../admin-auth/admin-auth.service.js";
import { hashPassword, isPasswordWithinBcryptLimit } from "../auth/password.js";
import { ADMIN_PERMISSIONS, type AdminPermission, isAdminPermission } from "../auth/permissions.js";

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type CreateAdminInput = {
  username: string;
  password: string;
  name?: string;
  role?: "ADMIN" | "SUPER_ADMIN";
  permissions?: AdminPermission[];
  mustChangePassword?: boolean;
};

type UpdateAdminInput = {
  name?: string | null;
  role?: "ADMIN" | "SUPER_ADMIN";
  status?: "ACTIVE" | "DISABLED";
  mustChangePassword?: boolean;
};

type ResetPasswordInput = {
  password: string;
  mustChangePassword?: boolean;
};

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isSuperAdmin(actor: AdminContext) {
  return actor.actorType === "ENV_ADMIN" || actor.isSuperAdmin || actor.permissions.includes("super_admin.manage");
}

function assertCanManageAdmins(actor: AdminContext) {
  if (isSuperAdmin(actor) || actor.permissions.includes("admins.manage")) return;

  throw Object.assign(new Error("Permission required"), {
    status: 403,
    code: "PERMISSION_REQUIRED"
  });
}

function assertCanReadAdmins(actor: AdminContext) {
  if (isSuperAdmin(actor) || actor.permissions.includes("admins.read") || actor.permissions.includes("admins.manage")) return;

  throw Object.assign(new Error("Permission required"), {
    status: 403,
    code: "PERMISSION_REQUIRED"
  });
}

function assertCanManageSuperAdmin(actor: AdminContext) {
  if (isSuperAdmin(actor)) return;

  throw Object.assign(new Error("Super admin permission required"), {
    status: 403,
    code: "SUPER_ADMIN_REQUIRED"
  });
}

function assertPermissionsAllowed(actor: AdminContext, permissions: AdminPermission[]) {
  for (const permission of permissions) {
    if (!isAdminPermission(permission)) {
      throw Object.assign(new Error("Unknown admin permission"), {
        status: 400,
        code: "UNKNOWN_ADMIN_PERMISSION"
      });
    }

    if (permission === "super_admin.manage") {
      assertCanManageSuperAdmin(actor);
    }

    if (!isSuperAdmin(actor) && !actor.permissions.includes(permission)) {
      throw Object.assign(new Error("Admins cannot grant permissions they do not have"), {
        status: 403,
        code: "PERMISSION_SCOPE_FORBIDDEN"
      });
    }
  }
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

function roleToApi(role: AdminAccountRole) {
  return role === AdminAccountRole.SUPER_ADMIN ? "super_admin" : "admin";
}

function statusToApi(status: AdminAccountStatus) {
  return status.toLowerCase();
}

function toAdminAccount(admin: {
  id: string;
  username: string;
  name: string | null;
  role: AdminAccountRole;
  status: AdminAccountStatus;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  permissions: { permission: string }[];
}) {
  const role = roleToApi(admin.role);

  return {
    id: admin.id,
    username: admin.username,
    name: admin.name,
    role,
    status: statusToApi(admin.status),
    isActive: admin.status === AdminAccountStatus.ACTIVE,
    permissions:
      admin.role === AdminAccountRole.SUPER_ADMIN
        ? [...ADMIN_PERMISSIONS]
        : admin.permissions
            .map((item) => item.permission)
            .filter((permission): permission is AdminPermission => isAdminPermission(permission))
            .sort(),
    mustChangePassword: admin.mustChangePassword,
    lastLoginAt: admin.lastLoginAt,
    passwordChangedAt: admin.passwordChangedAt,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt
  };
}

function auditActor(actor: AdminContext) {
  return {
    actorType: actor.actorType,
    actorAdminId: actor.actorType === "ADMIN_ACCOUNT" ? actor.id : null
  } as const;
}

async function audit(actor: AdminContext, action: string, targetId: string, metadata: Record<string, unknown>, meta?: RequestMeta) {
  await writeAdminAuditLog({
    ...auditActor(actor),
    action,
    targetType: "AdminAccount",
    targetId,
    metadata,
    ipAddress: meta?.ipAddress || null,
    userAgent: meta?.userAgent || null
  });
}

async function getAdminOrThrow(id: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const admin = await tx.adminAccount.findUnique({
    where: { id },
    include: { permissions: true }
  });

  if (!admin) {
    throw Object.assign(new Error("Admin account not found"), {
      status: 404,
      code: "ADMIN_ACCOUNT_NOT_FOUND"
    });
  }

  return admin;
}

async function assertNotLastDbSuperAdmin(id: string, tx: Prisma.TransactionClient) {
  const admin = await tx.adminAccount.findUnique({
    where: { id },
    select: { role: true, status: true }
  });

  if (admin?.role !== AdminAccountRole.SUPER_ADMIN || admin.status !== AdminAccountStatus.ACTIVE) return;

  const activeSuperAdminCount = await tx.adminAccount.count({
    where: {
      role: AdminAccountRole.SUPER_ADMIN,
      status: AdminAccountStatus.ACTIVE
    }
  });

  if (activeSuperAdminCount <= 1) {
    throw Object.assign(new Error("Cannot disable or demote the last DB super admin"), {
      status: 409,
      code: "LAST_SUPER_ADMIN_FORBIDDEN"
    });
  }
}

export async function listAdmins(actor: AdminContext) {
  assertCanReadAdmins(actor);

  const admins = await prisma.adminAccount.findMany({
    include: { permissions: true },
    orderBy: [{ role: "desc" }, { createdAt: "desc" }]
  });

  return admins.map(toAdminAccount);
}

export async function createAdmin(actor: AdminContext, input: CreateAdminInput, meta?: RequestMeta) {
  assertCanManageAdmins(actor);

  const username = normalizeUsername(input.username);
  const role = input.role === "SUPER_ADMIN" ? AdminAccountRole.SUPER_ADMIN : AdminAccountRole.ADMIN;
  const permissions = [...new Set(input.permissions || [])];

  if (role === AdminAccountRole.SUPER_ADMIN) assertCanManageSuperAdmin(actor);
  assertPermissionsAllowed(actor, permissions);
  assertStrongAdminPassword(username, input.password);

  const passwordHash = await hashPassword(input.password);

  const admin = await prisma.$transaction(async (tx) => {
    const existing = await tx.adminAccount.findUnique({
      where: { username },
      select: { id: true }
    });

    if (existing) {
      throw Object.assign(new Error("Admin username already exists"), {
        status: 409,
        code: "ADMIN_USERNAME_EXISTS"
      });
    }

    const created = await tx.adminAccount.create({
      data: {
        username,
        passwordHash,
        name: input.name?.trim() || null,
        role,
        status: AdminAccountStatus.ACTIVE,
        mustChangePassword: input.mustChangePassword ?? false,
        passwordChangedAt: new Date(),
        permissions: {
          create: permissions.map((permission) => ({ permission }))
        }
      },
      include: { permissions: true }
    });

    return created;
  });

  await audit(actor, "admin.created", admin.id, { username: admin.username, role: admin.role, permissions }, meta);
  return toAdminAccount(admin);
}

export async function updateAdmin(actor: AdminContext, adminId: string, input: UpdateAdminInput, meta?: RequestMeta) {
  assertCanManageAdmins(actor);

  const admin = await prisma.$transaction(async (tx) => {
    const existing = await getAdminOrThrow(adminId, tx);
    const nextRole = input.role ? (input.role === "SUPER_ADMIN" ? AdminAccountRole.SUPER_ADMIN : AdminAccountRole.ADMIN) : existing.role;
    const nextStatus = input.status
      ? input.status === "DISABLED"
        ? AdminAccountStatus.DISABLED
        : AdminAccountStatus.ACTIVE
      : existing.status;

    if (existing.role === AdminAccountRole.SUPER_ADMIN || nextRole === AdminAccountRole.SUPER_ADMIN) {
      assertCanManageSuperAdmin(actor);
    }

    if (actor.actorType === "ADMIN_ACCOUNT" && actor.id === adminId) {
      if (nextStatus === AdminAccountStatus.DISABLED && existing.status !== AdminAccountStatus.DISABLED) {
        throw Object.assign(new Error("Admins cannot disable their own account"), {
          status: 400,
          code: "SELF_DISABLE_FORBIDDEN"
        });
      }

      if (nextRole !== AdminAccountRole.SUPER_ADMIN && existing.role === AdminAccountRole.SUPER_ADMIN) {
        throw Object.assign(new Error("Admins cannot demote their own account"), {
          status: 400,
          code: "SELF_DEMOTE_FORBIDDEN"
        });
      }
    }

    if (
      (nextStatus === AdminAccountStatus.DISABLED && existing.status !== AdminAccountStatus.DISABLED) ||
      (nextRole !== AdminAccountRole.SUPER_ADMIN && existing.role === AdminAccountRole.SUPER_ADMIN)
    ) {
      await assertNotLastDbSuperAdmin(adminId, tx);
    }

    const incrementsSession =
      nextRole !== existing.role ||
      nextStatus !== existing.status ||
      input.mustChangePassword !== undefined;

    return tx.adminAccount.update({
      where: { id: adminId },
      data: {
        ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
        role: nextRole,
        status: nextStatus,
        ...(input.mustChangePassword !== undefined ? { mustChangePassword: input.mustChangePassword } : {}),
        ...(incrementsSession ? { sessionVersion: { increment: 1 } } : {})
      },
      include: { permissions: true }
    });
  });

  const actions = input.status === "DISABLED" ? ["admin.updated", "admin.disabled"] : input.status === "ACTIVE" ? ["admin.updated", "admin.enabled"] : ["admin.updated"];
  for (const action of actions) {
    await audit(actor, action, admin.id, { username: admin.username, role: admin.role, status: admin.status }, meta);
  }

  return toAdminAccount(admin);
}

export async function resetAdminPassword(actor: AdminContext, adminId: string, input: ResetPasswordInput, meta?: RequestMeta) {
  assertCanManageAdmins(actor);

  const existing = await getAdminOrThrow(adminId);
  if (existing.role === AdminAccountRole.SUPER_ADMIN) assertCanManageSuperAdmin(actor);
  assertStrongAdminPassword(existing.username, input.password);
  const passwordHash = await hashPassword(input.password);

  const admin = await prisma.adminAccount.update({
    where: { id: adminId },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: input.mustChangePassword ?? false,
      sessionVersion: { increment: 1 }
    },
    include: { permissions: true }
  });

  await audit(actor, "admin.password_reset", admin.id, { username: admin.username }, meta);
  return toAdminAccount(admin);
}

export async function replaceAdminPermissions(actor: AdminContext, adminId: string, permissions: AdminPermission[], meta?: RequestMeta) {
  assertCanManageAdmins(actor);
  const uniquePermissions = [...new Set(permissions)];
  assertPermissionsAllowed(actor, uniquePermissions);

  const admin = await prisma.$transaction(async (tx) => {
    const existing = await getAdminOrThrow(adminId, tx);
    if (existing.role === AdminAccountRole.SUPER_ADMIN) assertCanManageSuperAdmin(actor);
    await tx.adminAccountPermission.deleteMany({ where: { adminAccountId: adminId } });
    if (uniquePermissions.length) {
      await tx.adminAccountPermission.createMany({
        data: uniquePermissions.map((permission) => ({ adminAccountId: adminId, permission })),
        skipDuplicates: true
      });
    }

    return tx.adminAccount.update({
      where: { id: adminId },
      data: {
        sessionVersion: { increment: 1 }
      },
      include: { permissions: true }
    });
  });

  await audit(actor, "admin.permissions_updated", admin.id, { username: admin.username, permissions: uniquePermissions }, meta);
  return toAdminAccount(admin);
}

export async function disableAdmin(actor: AdminContext, adminId: string, meta?: RequestMeta) {
  return updateAdmin(actor, adminId, { status: "DISABLED" }, meta);
}

export async function enableAdmin(actor: AdminContext, adminId: string, meta?: RequestMeta) {
  return updateAdmin(actor, adminId, { status: "ACTIVE" }, meta);
}

export async function grantPermissionToAdmin(actor: AdminContext, adminId: string, permission: AdminPermission, meta?: RequestMeta) {
  const existing = await getAdminOrThrow(adminId);
  const permissions = new Set(existing.permissions.map((item) => item.permission).filter(isAdminPermission));
  permissions.add(permission);
  return replaceAdminPermissions(actor, adminId, [...permissions], meta);
}

export async function revokePermissionFromAdmin(actor: AdminContext, adminId: string, permission: AdminPermission, meta?: RequestMeta) {
  const existing = await getAdminOrThrow(adminId);
  const permissions = existing.permissions.map((item) => item.permission).filter(isAdminPermission).filter((item) => item !== permission);
  return replaceAdminPermissions(actor, adminId, permissions, meta);
}
