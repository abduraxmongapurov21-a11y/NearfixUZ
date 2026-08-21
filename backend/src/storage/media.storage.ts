import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import {
  deleteObjectFromR2,
  uploadObjectToR2,
  type UploadObjectInput
} from "./r2.storage.js";

export type MediaStorageProvider = "r2" | "local";

export type StoredMediaObject = {
  objectKey: string;
  url: string;
  provider: MediaStorageProvider;
};

const storageDirectory = path.dirname(fileURLToPath(import.meta.url));
export const localUploadRoot = path.resolve(storageDirectory, "../../uploads");

function localStorageError(message: string, code: string, cause?: unknown) {
  return Object.assign(new Error(message), {
    status: 500,
    code,
    cause
  });
}

function resolveLocalObjectPath(objectKey: string, root = localUploadRoot) {
  const normalizedRoot = path.resolve(root);
  const objectPath = path.resolve(normalizedRoot, objectKey);

  if (!objectPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw localStorageError("Invalid local upload object key", "LOCAL_UPLOAD_INVALID_KEY");
  }

  return objectPath;
}

function publicObjectUrl(publicBaseUrl: string, objectKey: string) {
  const baseUrl = publicBaseUrl.replace(/\/+$/, "");
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/uploads/${encodedKey}`;
}

export function createLocalMediaStorage(root = localUploadRoot) {
  return {
    async upload(input: UploadObjectInput, publicBaseUrl: string): Promise<StoredMediaObject> {
      const objectPath = resolveLocalObjectPath(input.objectKey, root);

      try {
        await mkdir(path.dirname(objectPath), { recursive: true });
        await writeFile(objectPath, input.body, { flag: "wx" });
      } catch (error) {
        throw localStorageError("Local media upload failed", "LOCAL_UPLOAD_FAILED", error);
      }

      return {
        objectKey: input.objectKey,
        url: publicObjectUrl(publicBaseUrl, input.objectKey),
        provider: "local"
      };
    },

    async delete(objectKey: string) {
      const objectPath = resolveLocalObjectPath(objectKey, root);

      try {
        await unlink(objectPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw localStorageError("Local media deletion failed", "LOCAL_DELETE_FAILED", error);
      }
    }
  };
}

const localStorage = createLocalMediaStorage();

function isR2NotConfigured(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "R2_NOT_CONFIGURED"
  );
}

export async function uploadMediaObject(
  input: UploadObjectInput,
  localPublicBaseUrl: string
): Promise<StoredMediaObject> {
  try {
    const uploaded = await uploadObjectToR2(input);
    return { ...uploaded, provider: "r2" };
  } catch (error) {
    if (env.NODE_ENV === "production" || !isR2NotConfigured(error)) throw error;
    return localStorage.upload(input, localPublicBaseUrl);
  }
}

export function deleteMediaObject(object: Pick<StoredMediaObject, "objectKey" | "provider">) {
  if (object.provider === "local") return localStorage.delete(object.objectKey);
  return deleteObjectFromR2(object.objectKey);
}
