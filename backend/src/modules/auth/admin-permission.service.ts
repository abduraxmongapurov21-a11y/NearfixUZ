import { prisma } from "../../db/prisma.js";
import type { AdminPermission } from "./permissions.js";
import { isAdminPermission } from "./permissions.js";

function assertAdminPermission(permission: string): asserts permission is AdminPermission {
  if (!isAdminPermission(permission)) {
    throw Object.assign(new Error("Unknown admin permission"), {
      status: 400,
      code: "UNKNOWN_ADMIN_PERMISSION"
    });
  }
}

export async function grantAdminPermission(userId: string, permission: string) {
  assertAdminPermission(permission);

  return prisma.$transaction(async (tx) => {
    const adminPermission = await tx.adminPermission.upsert({
      where: {
        userId_permission: {
          userId,
          permission
        }
      },
      update: {},
      create: {
        userId,
        permission
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        sessionVersion: {
          increment: 1
        }
      }
    });

    await tx.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true }
    });

    return adminPermission;
  });
}

export async function revokeAdminPermission(userId: string, permission: string) {
  assertAdminPermission(permission);

  return prisma.$transaction(async (tx) => {
    await tx.adminPermission.deleteMany({
      where: {
        userId,
        permission
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        sessionVersion: {
          increment: 1
        }
      }
    });

    await tx.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true }
    });
  });
}
