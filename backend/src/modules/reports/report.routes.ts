import { Router } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { createReportSchema } from "./report.contracts.js";
import { createReport } from "./report.service.js";

export const reportRouter = Router();

reportRouter.use(authenticate);

reportRouter.post("/", async (request, response, next) => {
  try {
    const input = createReportSchema.parse(request.body);
    const report = await createReport(request.user!, input);
    response.status(201).json({ ok: true, report });
  } catch (error) {
    next(error);
  }
});
