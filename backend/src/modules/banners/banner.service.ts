import { BannerTargetType, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

type BannerInput = {
  title: string;
  imageUrl: string;
  targetType: BannerTargetType;
  targetValue?: string;
  sortOrder?: number;
  isActive?: boolean;
};

type BannerPatch = Partial<BannerInput>;

function normalizeTargetValue(targetType: BannerTargetType, targetValue?: string | null) {
  if (targetType === BannerTargetType.NONE) return null;
  return targetValue?.trim() || null;
}

async function nextSortOrder(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const aggregate = await tx.banner.aggregate({
    _max: { sortOrder: true }
  });

  return (aggregate._max.sortOrder ?? -1) + 1;
}

async function assertBannerExists(tx: Prisma.TransactionClient, bannerId: string) {
  const banner = await tx.banner.findUnique({ where: { id: bannerId }, select: { id: true } });
  if (!banner) {
    throw Object.assign(new Error("Banner not found"), {
      status: 404,
      code: "BANNER_NOT_FOUND"
    });
  }
}

export async function listAdminBanners() {
  return prisma.banner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });
}

export async function listPublicBanners() {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });
}

export async function createBanner(input: BannerInput) {
  const sortOrder = input.sortOrder ?? await nextSortOrder();

  return prisma.banner.create({
    data: {
      title: input.title,
      imageUrl: input.imageUrl,
      targetType: input.targetType,
      targetValue: normalizeTargetValue(input.targetType, input.targetValue),
      sortOrder,
      isActive: input.isActive ?? true
    }
  });
}

export async function updateBanner(bannerId: string, patch: BannerPatch) {
  const current = await prisma.banner.findUnique({ where: { id: bannerId } });

  if (!current) {
    throw Object.assign(new Error("Banner not found"), {
      status: 404,
      code: "BANNER_NOT_FOUND"
    });
  }

  const targetType = patch.targetType ?? current.targetType;

  return prisma.banner.update({
    where: { id: bannerId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
      ...(patch.targetType !== undefined ? { targetType: patch.targetType } : {}),
      ...(patch.targetValue !== undefined || patch.targetType !== undefined
        ? { targetValue: normalizeTargetValue(targetType, patch.targetValue ?? current.targetValue) }
        : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {})
    }
  });
}

export async function deleteBanner(bannerId: string) {
  await prisma.banner.delete({
    where: { id: bannerId }
  }).catch((error) => {
    if (error?.code === "P2025") {
      throw Object.assign(new Error("Banner not found"), {
        status: 404,
        code: "BANNER_NOT_FOUND"
      });
    }

    throw error;
  });
}

export async function reorderBanners(items: { id: string; sortOrder: number }[]) {
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      await assertBannerExists(tx, item.id);
    }

    await Promise.all(
      items.map((item) =>
        tx.banner.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder }
        })
      )
    );

    return tx.banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });
  });
}
