import { Router } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { deletePushTokenSchema, notificationsQuerySchema, pushTokenSchema } from "./notification.contracts.js";
import {
  countUnreadNotifications,
  deletePushToken,
  listNotificationsPage,
  markNotificationRead,
  savePushToken
} from "./notification.service.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get("/", async (request, response, next) => {
  try {
    const input = notificationsQuerySchema.parse(request.query);
    const [page, unreadCount] = await Promise.all([
      listNotificationsPage(request.user!.id, input),
      countUnreadNotifications(request.user!.id)
    ]);
    response.json({ ok: true, ...page, unreadCount });
  } catch (error) {
    next(error);
  }
});

notificationRouter.get("/unread-count", async (request, response, next) => {
  try {
    const count = await countUnreadNotifications(request.user!.id);
    response.json({ ok: true, count });
  } catch (error) {
    next(error);
  }
});

notificationRouter.patch("/:id/read", async (request, response, next) => {
  try {
    const notification = await markNotificationRead(request.user!.id, request.params.id);
    response.json({ ok: true, notification });
  } catch (error) {
    next(error);
  }
});

notificationRouter.delete("/push-token", async (request, response, next) => {
  try {
    const input = deletePushTokenSchema.parse(request.body);
    const result = await deletePushToken(request.user!.id, input);
    response.json({ ok: true, deletedCount: result.count });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post("/push-token", async (request, response, next) => {
  try {
    const input = pushTokenSchema.parse(request.body);
    const token = await savePushToken(request.user!.id, input.token, input.platform, input.deviceId);
    response.json({ ok: true, token });
  } catch (error) {
    next(error);
  }
});
