import { BannerTargetType, Prisma, type Category } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { releasedCategorySlugForLegacyValue } from "./category.legacy.js";

export type CategoryInput = {
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  iconKey: string;
  isActive?: boolean;
};

export type CategoryPatch = Partial<Omit<CategoryInput, "slug">>;

function notFound() {
  return Object.assign(new Error("Category not found"), { status: 404, code: "CATEGORY_NOT_FOUND" });
}

function inUse(referenceCount: number) {
  return Object.assign(new Error("Referenced category cannot be deleted"), {
    status: 409,
    code: "CATEGORY_IN_USE",
    referenceCount
  });
}

type CategoryWithCounts = Category & { _count?: { workers: number; orders: number }; bannerReferenceCount?: number };

export function toCategoryDto(category: CategoryWithCounts) {
  const workers = category._count?.workers || 0;
  const orders = category._count?.orders || 0;
  const banners = category.bannerReferenceCount || 0;
  const { _count: _ignored, bannerReferenceCount: _bannerReferenceCount, ...data } = category;
  return { ...data, referenceCount: workers + orders + banners, references: { workers, orders, banners } };
}

export function toPublicCategoryDto(category: Category) {
  return {
    id: category.id,
    slug: category.slug,
    nameUz: category.nameUz,
    nameRu: category.nameRu,
    nameEn: category.nameEn,
    iconKey: category.iconKey,
    sortOrder: category.sortOrder,
    isActive: category.isActive
  };
}

export async function listPublicCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export async function listAdminCategories() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { workers: true, orders: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
  const banners = await prisma.banner.findMany({
    where: { targetType: BannerTargetType.CATEGORY, targetValue: { not: null } },
    select: { targetValue: true }
  });
  return categories.map((category) => ({
    ...category,
    bannerReferenceCount: countBannerReferences(category, banners)
  }));
}

async function nextSortOrder(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const aggregate = await tx.category.aggregate({ _max: { sortOrder: true } });
  return (aggregate._max.sortOrder ?? -1) + 1;
}

async function lockCategoryOrder(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('nearfix-category-reorder'))");
}

export async function createCategory(input: CategoryInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockCategoryOrder(tx);
      return tx.category.create({
        data: {
          slug: input.slug.toLowerCase(),
          nameUz: input.nameUz,
          nameRu: input.nameRu,
          nameEn: input.nameEn,
          iconKey: input.iconKey,
          sortOrder: await nextSortOrder(tx),
          isActive: input.isActive ?? true
        }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Object.assign(new Error("Category slug already exists"), { status: 409, code: "CATEGORY_SLUG_EXISTS" });
    }
    throw error;
  }
}

export async function updateCategory(categoryId: string, patch: CategoryPatch) {
  try {
    return await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(patch.nameUz !== undefined ? { nameUz: patch.nameUz } : {}),
        ...(patch.nameRu !== undefined ? { nameRu: patch.nameRu } : {}),
        ...(patch.nameEn !== undefined ? { nameEn: patch.nameEn } : {}),
        ...(patch.iconKey !== undefined ? { iconKey: patch.iconKey } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {})
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw notFound();
    throw error;
  }
}

export async function reorderCategories(items: { id: string; sortOrder: number }[]) {
  return prisma.$transaction(async (tx) => {
    await lockCategoryOrder(tx);
    const existing = await tx.category.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map((category) => category.id));
    const submittedIds = new Set(items.map((item) => item.id));
    const submittedPositions = new Set(items.map((item) => item.sortOrder));
    const positionsAreContiguous = items.every((_, index) => submittedPositions.has(index));
    if (
      items.length !== existingIds.size
      || submittedIds.size !== items.length
      || submittedPositions.size !== items.length
      || !positionsAreContiguous
      || items.some((item) => !existingIds.has(item.id))
    ) {
      throw Object.assign(new Error("Reorder payload must contain every category exactly once"), {
        status: 400,
        code: "CATEGORY_REORDER_INVALID"
      });
    }
    const orderedItems = [...items].sort((left, right) => left.sortOrder - right.sortOrder);
    for (const [sortOrder, item] of orderedItems.entries()) {
      await tx.category.update({ where: { id: item.id }, data: { sortOrder } });
    }
    const categories = await tx.category.findMany({
      include: { _count: { select: { workers: true, orders: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    const banners = await tx.banner.findMany({
      where: { targetType: BannerTargetType.CATEGORY, targetValue: { not: null } },
      select: { targetValue: true }
    });
    return categories.map((category) => ({
      ...category,
      bannerReferenceCount: countBannerReferences(category, banners)
    }));
  });
}

export async function deleteCategory(categoryId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: categoryId },
        include: { _count: { select: { workers: true, orders: true } } }
      });
      if (!category) throw notFound();
      const banners = await tx.banner.findMany({
        where: { targetType: BannerTargetType.CATEGORY, targetValue: { not: null } },
        select: { targetValue: true }
      });
      const referenceCount = category._count.workers + category._count.orders + countBannerReferences(category, banners);
      if (referenceCount) throw inUse(referenceCount);
      await tx.category.delete({ where: { id: categoryId } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw inUse(1);
    throw error;
  }
}

export async function getActiveCategoriesByIds(categoryIds: string[], tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const uniqueIds = Array.from(new Set(categoryIds));
  const categories = await tx.category.findMany({ where: { id: { in: uniqueIds }, isActive: true } });
  if (categories.length !== uniqueIds.length) {
    throw Object.assign(new Error("One or more categories are missing or inactive"), {
      status: 400,
      code: "CATEGORY_INACTIVE_OR_NOT_FOUND"
    });
  }
  const byId = new Map(categories.map((category) => [category.id, category]));
  return uniqueIds.map((id) => byId.get(id)!);
}

export async function matchCategoriesByLegacyValues(values: string[], tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const normalized = Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)));
  if (!normalized.length) return [];
  const categories = await tx.category.findMany();
  return normalized
    .map((value) => {
      const releasedSlug = releasedCategorySlugForLegacyValue(value);
      return categories.find((category) => category.slug === releasedSlug)
        || categories.find((category) =>
          [category.slug, category.nameUz, category.nameRu, category.nameEn]
            .some((candidate) => candidate.toLowerCase() === value)
        );
    })
    .filter((category): category is Category => Boolean(category));
}

export async function resolveCategoryByLegacyValue(value: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return (await matchCategoriesByLegacyValues([value], tx))[0] || null;
}

function countBannerReferences(category: Category, banners: { targetValue: string | null }[]) {
  const categoryValues = new Set(
    [category.id, category.slug, category.nameUz, category.nameRu, category.nameEn]
      .map((value) => value.trim().toLowerCase())
  );
  return banners.filter((banner) => {
    const value = banner.targetValue?.trim().toLowerCase();
    if (!value) return false;
    return categoryValues.has(value) || releasedCategorySlugForLegacyValue(value) === category.slug;
  }).length;
}
