import { Router, type Request } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { createR2ObjectKey } from "../../storage/r2.storage.js";
import { uploadMediaObject } from "../../storage/media.storage.js";
import { writeAdminAuditLog } from "../admin-auth/admin-audit.service.js";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { requirePermission } from "../auth/middleware/permission.guard.js";
import { requireRole } from "../auth/middleware/role.guard.js";
import { adminBannersQuerySchema, createBannerSchema, publicBannersQuerySchema, reorderBannersSchema, updateBannerSchema } from "./banner.contracts.js";
import { createBanner, deleteBanner, listAdminBanners, listPublicBanners, reorderBanners, updateBanner } from "./banner.service.js";

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "video/mp4"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(Object.assign(new Error("Only JPEG, PNG, WebP images or MP4 videos are allowed"), {
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

// Header/type validation only; decoding and video codec compatibility are not
// guaranteed by a MIME declaration or a matching container signature.
function matchesMediaSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP";
  }
  if (mimeType !== "video/mp4") return false;
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const boxSize = bytes.readUInt32BE(offset);
    if (boxSize < 8 || boxSize > bytes.length - offset) return false;
    const boxType = bytes.toString("latin1", offset + 4, offset + 8);
    if (boxType !== "ftyp") {
      if (boxType !== "free" && boxType !== "skip") return false;
      offset += boxSize;
      continue;
    }
    if (boxSize < 16 || boxSize % 4 !== 0) return false;
    const mp4Brands = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "M4VH", "M4VP", "MSNV", "dash", "cmfc", "cmfs"]);
    if (mp4Brands.has(bytes.toString("latin1", offset + 8, offset + 12))) return true;
    for (let brandOffset = offset + 16; brandOffset < offset + boxSize; brandOffset += 4) {
      if (mp4Brands.has(bytes.toString("latin1", brandOffset, brandOffset + 4))) return true;
    }
    return false;
  }
  return false;
}

export const adminBannerRouter = Router();
export const contentBannerRouter = Router();

function toPublicBannerUrl(request: Request, imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.pathname.startsWith("/uploads/")) {
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
    const query = adminBannersQuerySchema.parse(request.query);
    const banners = await listAdminBanners(query.placement);
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

adminBannerRouter.post("/upload", requirePermission("content.manage"), (request, response, next) => {
  upload.single("file")(request, response, (error) => {
    if (error instanceof multer.MulterError) Object.assign(error, { status: error.code === "LIMIT_FILE_SIZE" ? 413 : 400 });
    next(error);
  });
}, async (request, response, next) => {
  try {
    const file = request.file;

    if (!file) {
      throw Object.assign(new Error("File is required"), {
        status: 400,
        code: "FILE_REQUIRED"
      });
    }

    const mimeType = normalizeMimeType(file.mimetype);
    if (mimeType.startsWith("image/") && file.size > 10 * 1024 * 1024) {
      throw Object.assign(new Error("Images must not exceed 10 MB"), { status: 413, code: "LIMIT_FILE_SIZE" });
    }
    if (!matchesMediaSignature(file.buffer, mimeType)) {
      throw Object.assign(new Error("File content does not match the declared image or MP4 type"), { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
    }
    const objectKey = createR2ObjectKey("banners", file.originalname, mimeType);
    const uploaded = await uploadMediaObject({
      objectKey,
      body: file.buffer,
      contentType: mimeType,
      contentLength: file.size
    }, `${request.protocol}://${request.get("host")}`);

    response.json({
      ok: true,
      imageUrl: uploaded.url,
      mediaType: mimeType.startsWith("video/") ? "VIDEO" : "IMAGE"
    });
  } catch (error) {
    next(error);
  }
});

adminBannerRouter.patch("/reorder", requirePermission("content.manage"), async (request, response, next) => {
  try {
    const input = reorderBannersSchema.parse(request.body);
    const banners = await reorderBanners(input.items, input.placement);
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
    const query = publicBannersQuerySchema.parse(request.query);
    const banners = await listPublicBanners(query.placement);
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
