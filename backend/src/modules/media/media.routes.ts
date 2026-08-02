import { MediaScope } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import {
  createR2ObjectKey,
  deleteObjectFromR2,
  type R2ObjectPrefix,
  uploadObjectToR2
} from "../../storage/r2.storage.js";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { createUploadedMedia } from "./media.service.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(Object.assign(new Error("Only image and video files are allowed"), {
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE"
      }));
      return;
    }

    callback(null, true);
  }
});

function resolveScope(value: unknown) {
  const raw = typeof value === "string" ? value.toUpperCase() : undefined;
  if (raw && raw in MediaScope) return MediaScope[raw as keyof typeof MediaScope];
  return undefined;
}

function normalizeMimeType(value: string) {
  const mimeType = value.toLowerCase();
  if (mimeType === "image/jpg" || mimeType === "image/pjpeg") return "image/jpeg";
  if (mimeType === "image/x-png") return "image/png";
  return mimeType;
}

function resolveObjectPrefix(scope?: MediaScope): R2ObjectPrefix {
  if (scope === MediaScope.WORKER_GALLERY) return "media/workers";
  if (scope === MediaScope.ORDER_PROBLEM || scope === MediaScope.REVIEW) return "media/orders";
  return "media/chat";
}

export const mediaRouter = Router();

mediaRouter.post("/upload", authenticate, upload.single("file"), async (request, response, next) => {
  try {
    const file = request.file;

    if (!file) {
      throw Object.assign(new Error("File is required"), {
        status: 400,
        code: "FILE_REQUIRED"
      });
    }

    const scope = resolveScope(request.body.scope);
    const mimeType = normalizeMimeType(file.mimetype);
    const objectKey = createR2ObjectKey(resolveObjectPrefix(scope), file.originalname, mimeType);
    const uploaded = await uploadObjectToR2({
      objectKey,
      body: file.buffer,
      contentType: mimeType,
      contentLength: file.size
    });

    let media;
    try {
      media = await createUploadedMedia(request.user!, {
        roomId: typeof request.body.roomId === "string" ? request.body.roomId : undefined,
        orderId: typeof request.body.orderId === "string" ? request.body.orderId : undefined,
        scope,
        url: uploaded.url,
        fileName: file.originalname,
        mimeType,
        size: file.size
      });
    } catch (error) {
      await deleteObjectFromR2(objectKey).catch(() => undefined);
      throw error;
    }

    response.json({ ok: true, media });
  } catch (error) {
    next(error);
  }
});
