import { BannerMediaType, BannerPlacement, BannerTargetType, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { bannerTargetSchema } from "./banner.contracts.js";

type BannerInput = {
  title: string;
  imageUrl: string;
  placement?: BannerPlacement;
  mediaType?: BannerMediaType;
  targetType: BannerTargetType;
  targetValue?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

type BannerPatch = Partial<BannerInput>;

function normalizeTargetValue(targetType: BannerTargetType, targetValue?: string | null) {
  if (targetType === BannerTargetType.NONE) return null;
  return targetValue?.trim() || null;
}

async function nextSortOrder(placement: BannerPlacement) {
  const aggregate = await prisma.banner.aggregate({
    where: { placement },
    _max: { sortOrder: true }
  });

  return (aggregate._max.sortOrder ?? -1) + 1;
}

async function assertBannerExists(tx: Prisma.TransactionClient, bannerId: string, placement?: BannerPlacement) {
  const banner = await tx.banner.findUnique({ where: { id: bannerId }, select: { id: true, placement: true } });
  if (!banner) {
    throw Object.assign(new Error("Banner not found"), {
      status: 404,
      code: "BANNER_NOT_FOUND"
    });
  }
  if (placement && banner.placement !== placement) {
    throw Object.assign(new Error("Banner belongs to a different placement"), {
      status: 400,
      code: "BANNER_PLACEMENT_MISMATCH"
    });
  }
}

export async function listAdminBanners(placement?: BannerPlacement) {
  return prisma.banner.findMany({
    where: placement ? { placement } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });
}

export async function listPublicBanners(placement: BannerPlacement = BannerPlacement.HOME) {
  return prisma.banner.findMany({
    where: { isActive: true, placement },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });
}

export async function createBanner(input: BannerInput) {
  bannerTargetSchema.parse(input);
  const placement = input.placement ?? BannerPlacement.HOME;
  const sortOrder = input.sortOrder ?? await nextSortOrder(placement);

  return prisma.banner.create({
    data: {
      title: input.title,
      imageUrl: input.imageUrl,
      placement,
      mediaType: input.mediaType ?? BannerMediaType.IMAGE,
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
  if (patch.placement !== undefined && patch.placement !== current.placement) {
    throw Object.assign(new Error("Banner placement cannot be changed. Create it in the other placement instead."), {
      status: 400,
      code: "BANNER_PLACEMENT_MISMATCH"
    });
  }
  const targetValue = targetType === BannerTargetType.NONE ? null : patch.targetValue !== undefined ? patch.targetValue : current.targetValue;
  bannerTargetSchema.parse({ targetType, targetValue });

  return prisma.banner.update({
    where: { id: bannerId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
      ...(patch.placement !== undefined ? { placement: patch.placement } : {}),
      ...(patch.mediaType !== undefined ? { mediaType: patch.mediaType } : {}),
      ...(patch.targetType !== undefined ? { targetType: patch.targetType } : {}),
      ...(patch.targetValue !== undefined || patch.targetType !== undefined
        ? { targetValue: normalizeTargetValue(targetType, targetValue) }
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

export async function reorderBanners(items: { id: string; sortOrder: number }[], placement?: BannerPlacement) {
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      await assertBannerExists(tx, item.id, placement);
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
      where: placement ? { placement } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });
  });
}
