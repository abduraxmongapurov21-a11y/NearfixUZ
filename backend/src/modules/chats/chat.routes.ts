import { ChatRoomType } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import {
  chatRoomTypeSchema,
  createMessageSchema,
  createWorkerGroupRoomSchema
} from "./chat.contracts.js";
import {
  createMessage,
  createWorkerGroupRoom,
  ensureOrderChatRoom,
  ensureWorkerDirectChatRoom,
  listChatRooms,
  listMessages,
  markRoomRead
} from "./chat.service.js";

export const chatRouter = Router();

chatRouter.use(authenticate);

chatRouter.get("/rooms", async (request, response, next) => {
  try {
    const type = chatRoomTypeSchema.parse(
      typeof request.query.type === "string" ? request.query.type.toUpperCase() : undefined
    );
    const rooms = await listChatRooms(request.user!, type);

    response.json({ ok: true, rooms });
  } catch (error) {
    next(error);
  }
});

chatRouter.post("/rooms/order/:orderId", async (request, response, next) => {
  try {
    const room = await ensureOrderChatRoom(request.user!, request.params.orderId);

    response.json({ ok: true, room });
  } catch (error) {
    next(error);
  }
});

chatRouter.post("/rooms/worker/:workerId", async (request, response, next) => {
  try {
    const room = await ensureWorkerDirectChatRoom(request.user!, request.params.workerId);

    response.json({ ok: true, room });
  } catch (error) {
    next(error);
  }
});

chatRouter.post("/rooms/worker-group", async (request, response, next) => {
  try {
    const input = createWorkerGroupRoomSchema.parse(request.body);
    const room = await createWorkerGroupRoom(request.user!, input);

    response.json({ ok: true, room });
  } catch (error) {
    next(error);
  }
});

chatRouter.get("/rooms/:roomId/messages", async (request, response, next) => {
  try {
    const messages = await listMessages(request.user!, request.params.roomId);

    response.json({ ok: true, messages });
  } catch (error) {
    next(error);
  }
});

chatRouter.post("/rooms/:roomId/messages", async (request, response, next) => {
  try {
    const input = createMessageSchema.parse(request.body);
    const message = await createMessage(request.user!, request.params.roomId, input);

    response.json({ ok: true, message });
  } catch (error) {
    next(error);
  }
});

chatRouter.patch("/rooms/:roomId/read", async (request, response, next) => {
  try {
    const participant = await markRoomRead(request.user!, request.params.roomId);

    response.json({ ok: true, participant });
  } catch (error) {
    next(error);
  }
});

export { ChatRoomType };
