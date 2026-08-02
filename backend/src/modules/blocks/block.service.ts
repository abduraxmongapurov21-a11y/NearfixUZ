import { UserStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { hasActiveOrderBetweenUsers } from "../reports/report.service.js";

async function ensureBlockTarget(user: AuthUser, blockedUserId: string) {
  if (user.id === blockedUserId) {
    throw Object.assign(new Error("You cannot block yourself"), {
      status: 400,
      code: "BLOCK_SELF_FORBIDDEN"
    });
  }

  const target = await prisma.user.findFirst({
    where: { id: blockedUserId, status: { not: UserStatus.DELETED } },
    select: { id: true }
  });
  if (!target) throw Object.assign(new Error("User not found"), { status: 404, code: "BLOCK_TARGET_NOT_FOUND" });

  const activeOrder = await hasActiveOrderBetweenUsers(user.id, blockedUserId);
  if (activeOrder) {
    throw Object.assign(new Error("Active order must be resolved before blocking this user"), {
      status: 409,
      code: "ACTIVE_ORDER_BLOCK_CONFLICT",
      orderId: activeOrder.id
    });
  }
}

export async function blockUser(user: AuthUser, blockedUserId: string) {
  await ensureBlockTarget(user, blockedUserId);
  return prisma.userBlock.upsert({
    where: { blockerId_blockedUserId: { blockerId: user.id, blockedUserId } },
    update: {},
    create: { blockerId: user.id, blockedUserId },
    include: { blockedUser: { select: { id: true, name: true, role: true } } }
  });
}

export async function unblockUser(user: AuthUser, blockedUserId: string) {
  await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedUserId } });
}

export async function listBlockedUsers(user: AuthUser) {
  return prisma.userBlock.findMany({
    where: { blockerId: user.id },
    include: { blockedUser: { select: { id: true, name: true, role: true, status: true } } },
    orderBy: { createdAt: "desc" }
  });
}

export async function assertUsersNotBlocked(firstUserId: string, secondUserId: string) {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: firstUserId, blockedUserId: secondUserId },
        { blockerId: secondUserId, blockedUserId: firstUserId }
      ]
    },
    select: { blockerId: true }
  });
  if (block) {
    throw Object.assign(new Error("Chat is unavailable because one user blocked the other"), {
      status: 403,
      code: "USER_BLOCKED_INTERACTION"
    });
  }
}
