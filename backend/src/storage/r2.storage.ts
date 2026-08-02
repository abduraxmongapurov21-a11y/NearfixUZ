import { randomUUID } from "node:crypto";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

export type R2ObjectPrefix = "media/chat" | "media/orders" | "media/workers" | "banners";

type R2StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
};

type R2CommandClient = {
  send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
};

type UploadObjectInput = {
  objectKey: string;
  body: Buffer;
  contentType: string;
  contentLength: number;
};

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm"
};

function storageError(message: string, code: string, cause?: unknown) {
  return Object.assign(new Error(message), {
    status: 502,
    code,
    cause
  });
}

function readR2Config(): R2StorageConfig {
  const values = {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL
  };

  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw Object.assign(new Error(`R2 configuration is missing: ${missing.join(", ")}`), {
      status: 500,
      code: "R2_NOT_CONFIGURED"
    });
  }

  return values as R2StorageConfig;
}

function normalizePublicUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function safeExtension(originalName: string, contentType: string) {
  const mappedExtension = extensionByMimeType[contentType];
  if (mappedExtension) return mappedExtension;

  const extension = path.extname(originalName || "").toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(extension)) return extension;
  return "";
}

export function createR2ObjectKey(prefix: R2ObjectPrefix, originalName: string, contentType: string) {
  return `${prefix}/${Date.now()}-${randomUUID()}${safeExtension(originalName, contentType)}`;
}

export function createR2Storage(config: R2StorageConfig, client?: R2CommandClient) {
  const publicUrl = normalizePublicUrl(config.publicUrl);
  const r2Client =
    client ||
    new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });

  return {
    async upload(input: UploadObjectInput) {
      try {
        await r2Client.send(
          new PutObjectCommand({
            Bucket: config.bucketName,
            Key: input.objectKey,
            Body: input.body,
            ContentType: input.contentType,
            ContentLength: input.contentLength,
            CacheControl: "public, max-age=31536000, immutable"
          })
        );
      } catch (error) {
        throw storageError("R2 upload failed", "R2_UPLOAD_FAILED", error);
      }

      return {
        objectKey: input.objectKey,
        url: `${publicUrl}/${input.objectKey}`
      };
    },

    async delete(objectKey: string) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: config.bucketName,
            Key: objectKey
          })
        );
      } catch (error) {
        throw storageError("R2 object deletion failed", "R2_DELETE_FAILED", error);
      }
    }
  };
}

let defaultStorage: ReturnType<typeof createR2Storage> | undefined;

function getDefaultStorage() {
  if (!defaultStorage) {
    defaultStorage = createR2Storage(readR2Config());
  }

  return defaultStorage;
}

export function uploadObjectToR2(input: UploadObjectInput) {
  return getDefaultStorage().upload(input);
}

export function deleteObjectFromR2(objectKey: string) {
  return getDefaultStorage().delete(objectKey);
}
