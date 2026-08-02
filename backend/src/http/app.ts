import cors, { type CorsOptions } from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { addressRouter } from "../modules/addresses/address.routes.js";
import { authenticateEnvAdmin } from "../modules/admin-auth/admin-auth.middleware.js";
import { adminAuthRouter } from "../modules/admin-auth/admin-auth.routes.js";
import { adminManagementRouter } from "../modules/admin-management/admin-management.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { adminBannerRouter, contentBannerRouter } from "../modules/banners/banner.routes.js";
import { chatRouter } from "../modules/chats/chat.routes.js";
import { favoriteRouter } from "../modules/favorites/favorite.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { legalRouter } from "../modules/legal/legal.routes.js";
import { mediaRouter } from "../modules/media/media.routes.js";
import { notificationRouter } from "../modules/notifications/notification.routes.js";
import { orderRouter } from "../modules/orders/order.routes.js";
import { supportRouter } from "../modules/support/support.routes.js";
import { reportRouter } from "../modules/reports/report.routes.js";
import { blockRouter } from "../modules/blocks/block.routes.js";
import { workerRouter } from "../modules/workers/worker.routes.js";
import { errorHandler } from "./error-handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../uploads");

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

const configuredOrigins = new Set(env.CORS_ORIGINS.split(",").map(normalizeOrigin).filter(Boolean));

function isDevelopmentOrigin(origin: string) {
  if (env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || configuredOrigins.has(normalizeOrigin(origin)) || isDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(
      Object.assign(new Error("Not allowed by CORS"), {
        status: 403,
        code: "CORS_ORIGIN_DENIED"
      })
    );
  }
};

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(uploadDir));

  app.use("/health", healthRouter);
  app.use("/legal", legalRouter);
  app.use("/auth", authRouter);
  app.use("/admin/auth", adminAuthRouter);
  app.use("/admin", authenticateEnvAdmin);
  app.use("/admin/admins", adminManagementRouter);
  app.use("/admin/banners", adminBannerRouter);
  app.use("/admin", adminRouter);
  app.use("/content", contentBannerRouter);
  app.use("/addresses", addressRouter);
  app.use("/favorites", favoriteRouter);
  app.use("/workers", workerRouter);
  app.use("/orders", orderRouter);
  app.use("/chats", chatRouter);
  app.use("/media", mediaRouter);
  app.use("/notifications", notificationRouter);
  app.use("/support", supportRouter);
  app.use("/reports", reportRouter);
  app.use("/blocks", blockRouter);

  app.use(errorHandler);

  return app;
}
