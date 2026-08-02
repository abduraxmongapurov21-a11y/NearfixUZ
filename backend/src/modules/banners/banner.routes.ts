import { Router, type Request } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { createR2ObjectKey, uploadObjectToR2 } from "../../storage/r2.storage.js";
import { writeAdminAuditLog } from "../admin-auth/admin-audit.service.js";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { requirePermission } from "../auth/middleware/permission.guard.js";
import { requireRole } from "../auth/middleware/role.guard.js";
import { createBannerSchema, reorderBannersSchema, updateBannerSchema } from "./banner.contracts.js";
import { createBanner, deleteBanner, listAdminBanners, listPublicBanners, reorderBanners, updateBanner } from "./banner.service.js";

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(Object.assign(new Error("Only image files are allowed"), {
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE"
      }));
      return;
    }

    callback(null, true);
  }
});

function normalizeMimeType(value: string) {
  const mimeType = value.toLowerCase();
  if (mimeType === "image/jpg" || mimeType === "image/pjpeg") return "image/jpeg";
  if (mimeType === "image/x-png") return "image/png";
  return mimeType;
}

export const adminBannerRouter = Router();
export const contentBannerRouter = Router();

function toPublicBannerUrl(request: Request, imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname) && url.pathname.startsWith("/uploads/")) {
      return `${request.protocol}://${request.get("host")}${url.pathname}`;
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

function toPublicBanner(request: Request, banner: { imageUrl: string }) {
  return {
    ...banner,
    imageUrl: toPublicBannerUrl(request, banner.imageUrl)
  };
}

async function auditBannerAction(
  request: Request,
  input: { action: string; targetId: string; metadata?: Record<string, unknown> }
) {
  if (!request.admin) return;

  await writeAdminAuditLog({
    actorType: request.admin.actorType,
    actorAdminId: request.admin.actorType === "ADMIN_ACCOUNT" ? request.admin.id : null,
    action: input.action,
    targetType: "Banner",
    targetId: input.targetId,
    metadata: {
      actorUsername: request.admin.username,
      ...input.metadata
    },
    ipAddress: request.ip,
    userAgent: request.get("user-agent") || null
  });
}

adminBannerRouter.use(authenticate, requireRole("ADMIN"));

adminBannerRouter.get("/", requirePermission("content.read"), async (request, response, next) => {
  try {
    const banners = await listAdminBanners();
    response.json({ ok: true, banners: banners.map((banner) => toPublicBanner(request, banner)) });
  } catch (error) {
    next(error);
  }
});

adminBannerRouter.post("/", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const input = createBannerSchema.parse(request.body);
    const banner = await createBanner(input);
    await auditBannerAction(request, {
      action: "banner.created",
      targetId: banner.id,
      metadata: { title: banner.title, targetType: banner.targetType, isActive: banner.isActive }
    });
    response.status(201).json({ ok: true, banner: toPublicBanner(request, banner) });
  } catch (error) {
    next(error);
  }
});

adminBannerRouter.post("/upload", requirePermission("content.manage"), upload.single("file"), async (request, response, next) => {
  try {
    const file = request.file;

    if (!file) {
      throw Object.assign(new Error("File is required"), {
        status: 400,
        code: "FILE_REQUIRED"
      });
    }

    const mimeType = normalizeMimeType(file.mimetype);
    const objectKey = createR2ObjectKey("banners", file.originalname, mimeType);
    const uploaded = await uploadObjectToR2({
      objectKey,
      body: file.buffer,
      contentType: mimeType,
      contentLength: file.size
    });

    response.json({
      ok: true,
      imageUrl: uploaded.url
    });
  } catch (error) {
    next(error);
  }
});

adminBannerRouter.patch("/reorder", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const input = reorderBannersSchema.parse(request.body);
    const banners = await reorderBanners(input.items);
    response.json({ ok: true, banners: banners.map((banner) => toPublicBanner(request, banner)) });
  } catch (error) {
    next(error);
  }
});

adminBannerRouter.patch("/:bannerId", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const input = updateBannerSchema.parse(request.body);
    const bannerId = String(request.params.bannerId);
    const banner = await updateBanner(bannerId, input);
    await auditBannerAction(request, {
      action: "banner.updated",
      targetId: bannerId,
      metadata: { changedFields: Object.keys(input) }
    });
    response.json({ ok: true, banner: toPublicBanner(request, banner) });
  } catch (error) {
    next(error);
  }
});

adminBannerRouter.delete("/:bannerId", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const bannerId = String(request.params.bannerId);
    await deleteBanner(bannerId);
    await auditBannerAction(request, {
      action: "banner.deleted",
      targetId: bannerId
    });
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

contentBannerRouter.get("/banners", async (request, response, next) => {
  try {
    const banners = await listPublicBanners();
    response.json({ ok: true, banners: banners.map((banner) => toPublicBanner(request, banner)) });
  } catch (error) {
    next(error);
  }
});

contentBannerRouter.get("/legal", (_request, response) => {
  response.json({
    ok: true,
    privacyPolicyUrl: env.PRIVACY_POLICY_URL || null,
    termsUrl: env.TERMS_URL || null
  });
});
