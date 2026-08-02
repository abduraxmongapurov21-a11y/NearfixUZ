import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { addFavorite, listFavorites, removeFavorite } from "./favorite.service.js";

export const favoriteRouter = Router();

const favoriteSchema = z.object({
  workerId: z.string().min(1)
});

favoriteRouter.use(authenticate);

favoriteRouter.get("/", async (request, response, next) => {
  try {
    const favorites = await listFavorites(request.user!.id);
    response.json({ ok: true, favorites });
  } catch (error) {
    next(error);
  }
});

favoriteRouter.post("/", async (request, response, next) => {
  try {
    const input = favoriteSchema.parse(request.body);
    const favorite = await addFavorite(request.user!.id, input.workerId);
    response.status(201).json({ ok: true, favorite });
  } catch (error) {
    next(error);
  }
});

favoriteRouter.delete("/:workerId", async (request, response, next) => {
  try {
    await removeFavorite(request.user!.id, request.params.workerId);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
