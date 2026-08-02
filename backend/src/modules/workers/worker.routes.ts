import { Router } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { requireRole } from "../auth/middleware/role.guard.js";
import { getWorkerRating, listWorkerReviews } from "../reviews/review.service.js";
import {
  catalogWorkersQuerySchema,
  updateAvailabilitySchema,
  updateWorkerProfileSchema,
  updateWorkerServiceLocationSchema
} from "./worker.contracts.js";
import {
  getCatalogWorkers,
  getOwnWorkerEarnings,
  getOwnWorkerProfile,
  getOwnWorkerTransactions,
  setWorkerAvailability,
  updateOwnWorkerProfile,
  updateOwnWorkerServiceLocation
} from "./worker.service.js";

export const workerRouter = Router();

workerRouter.get("/catalog", (request, response, next) => {
  if (request.query.originAddressId === undefined) {
    next();
    return;
  }
  authenticate(request, response, next);
}, async (request, response, next) => {
  try {
    const query = catalogWorkersQuerySchema.parse(request.query);
    const profession = query.profession || query.category;
    const workers = await getCatalogWorkers(query.cityId, profession, {
      originAddressId: query.originAddressId,
      requester: request.user,
      sort: query.sort
    });

    response.json({
      ok: true,
      workers
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.get("/me", authenticate, requireRole("PROVIDER"), async (request, response, next) => {
  try {
    const worker = await getOwnWorkerProfile(request.user!.id);

    response.json({
      ok: true,
      worker
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.get("/me/earnings", authenticate, requireRole("PROVIDER"), async (request, response, next) => {
  try {
    const earnings = await getOwnWorkerEarnings(request.user!.id);

    response.json({
      ok: true,
      earnings
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.get("/me/transactions", authenticate, requireRole("PROVIDER"), async (request, response, next) => {
  try {
    const transactions = await getOwnWorkerTransactions(request.user!.id);

    response.json({
      ok: true,
      transactions
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.get("/:workerId/reviews", async (request, response, next) => {
  try {
    const reviews = await listWorkerReviews(String(request.params.workerId));

    response.json({
      ok: true,
      reviews
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.get("/:workerId/rating", async (request, response, next) => {
  try {
    const rating = await getWorkerRating(String(request.params.workerId));

    response.json({
      ok: true,
      rating
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.patch("/me/profile", authenticate, requireRole("PROVIDER"), async (request, response, next) => {
  try {
    const input = updateWorkerProfileSchema.parse(request.body);
    const worker = await updateOwnWorkerProfile(request.user!.id, input);

    response.json({
      ok: true,
      worker
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.patch("/me/service-location", authenticate, requireRole("PROVIDER"), async (request, response, next) => {
  try {
    const input = updateWorkerServiceLocationSchema.parse(request.body);
    const worker = await updateOwnWorkerServiceLocation(request.user!.id, input);

    response.json({
      ok: true,
      worker
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.patch("/me/availability", authenticate, requireRole("PROVIDER"), async (request, response, next) => {
  try {
    const input = updateAvailabilitySchema.parse(request.body);
    const availability = await setWorkerAvailability(request.user!.id, input.status);

    response.json({
      ok: true,
      availability
    });
  } catch (error) {
    next(error);
  }
});
