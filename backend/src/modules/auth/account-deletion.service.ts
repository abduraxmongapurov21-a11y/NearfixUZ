import { UserRole, UserStatus, WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";

function deletedPhone(userId: string) {
  return `deleted+${userId}@nearfix.invalid`;
}

function normalizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\s+/g, "");
}

function isProtectedDemoAccount(phone: string | null | undefined) {
  if (!env.APP_REVIEW_DEMO_ENABLED) return false;

  const normalizedPhone = normalizePhone(phone);
  const protectedPhones = [
    env.APP_REVIEW_DEMO_CLIENT_PHONE,
    env.APP_REVIEW_DEMO_WORKER_PHONE
  ].map(normalizePhone).filter(Boolean);

  return protectedPhones.includes(normalizedPhone);
}

export async function deleteCurrentUserAccount(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        workerProfile: true
      }
    });

    if (!user) {
      throw Object.assign(new Error("User account not found"), {
        status: 404,
        code: "USER_NOT_FOUND"
      });
    }

    if (isProtectedDemoAccount(user.phone)) {
      throw Object.assign(new Error("App Review demo account cannot be deleted"), {
        status: 403,
        code: "DEMO_ACCOUNT_PROTECTED"
      });
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw Object.assign(new Error("Admin accounts must be managed by a super admin"), {
        status: 403,
        code: "ADMIN_ACCOUNT_DELETION_FORBIDDEN"
      });
    }

    if (user.status === UserStatus.DELETED) {
      return {
        userId: user.id,
        deletedAt: user.deletedAt
      };
    }

    await Promise.all([
      tx.session.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true }
      }),
      tx.pushToken.deleteMany({ where: { userId } }),
      tx.address.deleteMany({ where: { userId } }),
      tx.favorite.deleteMany({ where: { clientId: userId } }),
      tx.notification.deleteMany({ where: { userId } }),
      tx.otpChallenge.deleteMany({ where: { phone: user.phone } }),
      tx.userBlock.deleteMany({
        where: {
          OR: [{ blockerId: userId }, { blockedUserId: userId }]
        }
      })
    ]);

    if (user.workerProfile) {
      await tx.favorite.deleteMany({
        where: { workerId: user.workerProfile.id }
      });

      await tx.workerAvailability.updateMany({
        where: { workerId: user.workerProfile.id },
        data: {
          status: WorkerAvailabilityStatus.OFFLINE,
          activeOrderId: null,
          lockedUntil: null
        }
      });

      await tx.workerProfile.update({
        where: { id: user.workerProfile.id },
        data: {
          status: WorkerProfileStatus.SUSPENDED,
          profession: null,
          professions: [],
          experienceYears: null,
          profileImageUrl: null,
          bio: null,
          basePrice: null,
          submittedAt: null,
          verifiedAt: null,
          moderationReason: "Account deleted by user"
        }
      });
    }

    const deletedAt = new Date();
    const deleted = await tx.user.update({
      where: { id: userId },
      data: {
        phone: deletedPhone(userId),
        name: "O'chirilgan foydalanuvchi",
        cityId: null,
        passwordHash: null,
        passwordSetAt: null,
        passwordChangedAt: null,
        status: UserStatus.DELETED,
        deletedAt,
        sessionVersion: {
          increment: 1
        }
      }
    });

    return {
      userId: deleted.id,
      deletedAt: deleted.deletedAt
    };
  });
}
