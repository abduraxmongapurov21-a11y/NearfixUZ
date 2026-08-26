import { Router, type Request } from "express";
import { writeAdminAuditLog } from "../admin-auth/admin-audit.service.js";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { requirePermission } from "../auth/middleware/permission.guard.js";
import { requireRole } from "../auth/middleware/role.guard.js";
import { CATEGORY_ICON_KEYS, createCategorySchema, reorderCategoriesSchema, updateCategorySchema } from "./category.contracts.js";
import { createCategory, deleteCategory, listAdminCategories, listPublicCategories, reorderCategories, toCategoryDto, toPublicCategoryDto, updateCategory } from "./category.service.js";

export const adminCategoryRouter = Router();
export const contentCategoryRouter = Router();

async function audit(request: Request, action: string, targetId: string, metadata?: Record<string, unknown>) {
  if (!request.admin) return;
  await writeAdminAuditLog({
    actorType: request.admin.actorType,
    actorAdminId: request.admin.actorType === "ADMIN_ACCOUNT" ? request.admin.id : null,
    action,
    targetType: "Category",
    targetId,
    metadata: { actorUsername: request.admin.username, ...metadata },
    ipAddress: request.ip,
    userAgent: request.get("user-agent") || null
  });
}

adminCategoryRouter.use(authenticate, requireRole("ADMIN"));

adminCategoryRouter.get("/", requirePermission("content.read"), async (_request, response, next) => {
  try {
    const categories = await listAdminCategories();
    response.json({ ok: true, categories: categories.map(toCategoryDto), iconKeys: CATEGORY_ICON_KEYS });
  } catch (error) { next(error); }
});

adminCategoryRouter.post("/", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const input = createCategorySchema.parse(request.body);
    const category = await createCategory(input);
    await audit(request, "category.created", category.id, { slug: category.slug });
    response.status(201).json({ ok: true, category: toCategoryDto(category) });
  } catch (error) { next(error); }
});

adminCategoryRouter.patch("/reorder", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const input = reorderCategoriesSchema.parse(request.body);
    const categories = await reorderCategories(input.items);
    await audit(request, "category.reordered", "categories", { count: input.items.length });
    response.json({ ok: true, categories: categories.map(toCategoryDto) });
  } catch (error) { next(error); }
});

adminCategoryRouter.patch("/:categoryId", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const input = updateCategorySchema.parse(request.body);
    const categoryId = String(request.params.categoryId);
    const category = await updateCategory(categoryId, input);
    await audit(request, "category.updated", categoryId, { changedFields: Object.keys(input) });
    response.json({ ok: true, category: toCategoryDto(category) });
  } catch (error) { next(error); }
});

adminCategoryRouter.delete("/:categoryId", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const categoryId = String(request.params.categoryId);
    await deleteCategory(categoryId);
    await audit(request, "category.deleted", categoryId);
    response.json({ ok: true });
  } catch (error) { next(error); }
});

contentCategoryRouter.get("/categories", async (_request, response, next) => {
  try {
    const categories = await listPublicCategories();
    response.json({ ok: true, categories: categories.map(toPublicCategoryDto) });
  } catch (error) { next(error); }
});
