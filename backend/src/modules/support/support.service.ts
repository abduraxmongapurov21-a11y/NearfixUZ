import { prisma } from "../../db/prisma.js";
import { SupportTicketStatus, type Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-context.js";
import { getOrderForUser } from "../orders/order.service.js";

type CreateSupportTicketInput = {
  orderId?: string;
  reason: string;
  message?: string;
};

export async function createSupportTicket(user: AuthUser, input: CreateSupportTicketInput) {
  if (input.orderId) {
    await getOrderForUser(user, input.orderId);
  }

  return prisma.supportTicket.create({
    data: {
      userId: user.id,
      orderId: input.orderId,
      reason: input.reason,
      message: input.message
    }
  });
}

export async function listSupportTickets(user: AuthUser) {
  return prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });
}

export async function listAdminSupportTickets(query: Record<string, unknown>) {
  const status =
    typeof query.status === "string" && Object.values(SupportTicketStatus).includes(query.status as SupportTicketStatus)
      ? (query.status as SupportTicketStatus)
      : undefined;
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const where: Prisma.SupportTicketWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { reason: { contains: search, mode: "insensitive" } },
            { message: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { phone: { contains: search, mode: "insensitive" } } },
            { order: { publicCode: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  return prisma.supportTicket.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, phone: true, role: true, status: true } },
      order: { select: { id: true, publicCode: true, status: true, problemTitle: true } },
      resolvedByAdmin: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function getAdminSupportTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, name: true, phone: true, role: true, status: true } },
      order: true,
      resolvedByAdmin: { select: { id: true, name: true } }
    }
  });
  if (!ticket) throw Object.assign(new Error("Support ticket not found"), { status: 404, code: "SUPPORT_TICKET_NOT_FOUND" });
  return ticket;
}

export async function updateAdminSupportTicket(
  ticketId: string,
  adminId: string,
  input: { status: SupportTicketStatus; adminNote?: string }
) {
  const existing = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!existing) throw Object.assign(new Error("Support ticket not found"), { status: 404, code: "SUPPORT_TICKET_NOT_FOUND" });

  const resolverUserId = adminId === "env-admin" ? null : adminId;
  const terminal = input.status === SupportTicketStatus.RESOLVED || input.status === SupportTicketStatus.CLOSED;
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: input.status,
      adminNote: input.adminNote?.trim() || null,
      resolvedByAdminId: terminal ? resolverUserId : null,
      resolvedAt: terminal ? new Date() : null
    }
  });
}
