import { Router } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { createSupportTicketSchema } from "./support.contracts.js";
import { createSupportTicket, listSupportTickets } from "./support.service.js";

export const supportRouter = Router();

supportRouter.use(authenticate);

supportRouter.get("/tickets", async (request, response, next) => {
  try {
    const tickets = await listSupportTickets(request.user!);
    response.json({ ok: true, tickets });
  } catch (error) {
    next(error);
  }
});

supportRouter.post("/tickets", async (request, response, next) => {
  try {
    const input = createSupportTicketSchema.parse(request.body);
    const ticket = await createSupportTicket(request.user!, input);
    response.status(201).json({ ok: true, ticket });
  } catch (error) {
    next(error);
  }
});
