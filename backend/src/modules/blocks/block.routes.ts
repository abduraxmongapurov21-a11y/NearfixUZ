import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { blockUser, listBlockedUsers, unblockUser } from "./block.service.js";

const blockSchema = z.object({ blockedUserId: z.string().min(1) });
export const blockRouter = Router();

blockRouter.use(authenticate);

blockRouter.get("/", async (request, response, next) => {
  try {
    response.json({ ok: true, blocks: await listBlockedUsers(request.user!) });
  } catch (error) {
    next(error);
  }
});

blockRouter.post("/", async (request, response, next) => {
  try {
    const input = blockSchema.parse(request.body);
    response.status(201).json({ ok: true, block: await blockUser(request.user!, input.blockedUserId) });
  } catch (error) {
    next(error);
  }
});

blockRouter.delete("/:blockedUserId", async (request, response, next) => {
  try {
    await unblockUser(request.user!, String(request.params.blockedUserId));
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
