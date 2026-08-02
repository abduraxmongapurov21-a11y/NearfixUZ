import { apiRequest } from "../api/client";
import { fetchAuthRequest } from "../api/authenticatedClient";

function inferMimeType(file) {
  const explicitType = String(file.mimeType || file.type || "").toLowerCase();
  if (explicitType === "image/jpg" || explicitType === "image/pjpeg") return "image/jpeg";
  if (explicitType === "image/x-png") return "image/png";
  if (explicitType.startsWith("image/") || explicitType.startsWith("video/")) return explicitType;

  const source = `${file.name || ""} ${file.uri || ""}`.toLowerCase();
  if (source.includes(".jpg") || source.includes(".jpeg")) return "image/jpeg";
  if (source.includes(".png")) return "image/png";
  if (source.includes(".webp")) return "image/webp";
  if (source.includes(".heic")) return "image/heic";
  if (source.includes(".heif")) return "image/heif";
  if (source.includes(".mp4")) return "video/mp4";
  if (source.includes(".mov")) return "video/quicktime";

  return "image/jpeg";
}

function inferFileName(file, mimeType) {
  if (file.name) return file.name;

  const extensionByMime = {
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov"
  };

  return `nearfix-media-${Date.now()}.${extensionByMime[mimeType] || "jpg"}`;
}

export async function uploadMediaApi(token, file, context = {}) {
  return apiRequest(async () => {
    const mimeType = inferMimeType(file);
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: inferFileName(file, mimeType),
      type: mimeType
    });

    if (context.roomId) formData.append("roomId", context.roomId);
    if (context.orderId) formData.append("orderId", context.orderId);
    if (context.scope) formData.append("scope", context.scope);

    const payload = await fetchAuthRequest("/media/upload", {
      method: "POST",
      token,
      body: formData
    });

    return {
      ok: true,
      media: payload.media
    };
  });
}
