import { Router, type Request } from "express";
import { OrderStatus, ReportStatus, ReviewStatus, UserStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import { requirePermission } from "../auth/middleware/permission.guard.js";
import { requireRole } from "../auth/middleware/role.guard.js";
import { approveWorkerSchema, promoteProviderSchema, workerModerationSchema } from "./admin.contracts.js";
import {
  approveWorkerProfile,
  rejectWorkerProfile,
  suspendWorkerProfile,
  unsuspendWorkerProfile
} from "../workers/worker.service.js";
import { promoteUserToProvider } from "../users/user-role.service.js";
import { updateReportStatusSchema } from "../reports/report.contracts.js";
import { getAdminReport, listAdminReports, updateAdminReport } from "../reports/report.service.js";
import { updateSupportTicketSchema } from "../support/support.contracts.js";
import {
  getAdminSupportTicket,
  listAdminSupportTickets,
  updateAdminSupportTicket
} from "../support/support.service.js";
import { setReviewVisibility } from "../reviews/review.service.js";
import { listAdminAuditLogs, writeAdminAuditLog } from "../admin-auth/admin-audit.service.js";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("ADMIN"));

const maxAdminOrdersLimit = 100;

function readQueryValue(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function readPositiveInteger(value: unknown, fallback: number, max?: number) {
  const parsed = Number.parseInt(readQueryValue(value) || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function parseDate(value: unknown, endOfDay = false) {
  const raw = readQueryValue(value);
  if (!raw) return undefined;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function mapOrderStatusFilter(status?: string): Prisma.EnumOrderStatusFilter | undefined {
  if (!status) return undefined;

  const normalized = status.toUpperCase();
  if (status.toLowerCase() === "waiting") {
    return { in: [OrderStatus.CREATED, OrderStatus.WAITING_RESPONSE] };
  }
  if (status.toLowerCase() === "active") {
    return { in: [OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS] };
  }
  if (status.toLowerCase() === "completed") return { equals: OrderStatus.COMPLETED };
  if (status.toLowerCase() === "cancelled") return { equals: OrderStatus.CANCELLED };

  if (Object.values(OrderStatus).includes(normalized as OrderStatus)) {
    return { equals: normalized as OrderStatus };
  }

  return undefined;
}

async function auditAdminAction(
  request: Request,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }
) {
  if (!request.admin) return;

  await writeAdminAuditLog({
    actorType: request.admin.actorType,
    actorAdminId: request.admin.actorType === "ADMIN_ACCOUNT" ? request.admin.id : null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: {
      actorUsername: request.admin.username,
      ...input.metadata
    },
    ipAddress: request.ip,
    userAgent: request.get("user-agent") || null
  });
}

function reportAuditAction(status: ReportStatus) {
  if (status === ReportStatus.DISMISSED) return "report.rejected";
  if (status === ReportStatus.RESOLVED || status === ReportStatus.ACTION_TAKEN) return "report.resolved";
  return "report.status_updated";
}

function buildAdminOrdersWhere(query: Record<string, unknown>): Prisma.OrderWhereInput {
  const status = mapOrderStatusFilter(readQueryValue(query.status));
  const cityId = readQueryValue(query.cityId);
  const workerId = readQueryValue(query.workerId);
  const search = readQueryValue(query.search);
  const fromDate = parseDate(query.fromDate);
  const toDate = parseDate(query.toDate, true);

  return {
    ...(status ? { status } : {}),
    ...(cityId ? { cityId } : {}),
    ...(workerId ? { workerId } : {}),
    ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { publicCode: { contains: search, mode: "insensitive" } },
            { serviceType: { contains: search, mode: "insensitive" } },
            { problemTitle: { contains: search, mode: "insensitive" } },
            { problemDescription: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
            { client: { phone: { contains: search, mode: "insensitive" } } },
            { worker: { profession: { contains: search, mode: "insensitive" } } },
            { worker: { user: { name: { contains: search, mode: "insensitive" } } } },
            { worker: { user: { phone: { contains: search, mode: "insensitive" } } } }
          ]
        }
      : {})
  };
}

adminRouter.get("/dashboard", requirePermission("analytics.read"), async (request, response, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeOrders, waitingResponse, busyWorkers, completedToday, cancelledToday] = await Promise.all([
      prisma.order.count({ where: { status: { in: ["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"] } } }),
      prisma.order.count({ where: { status: "WAITING_RESPONSE" } }),
      prisma.workerAvailability.count({ where: { status: "BUSY" } }),
      prisma.order.count({ where: { status: "COMPLETED", updatedAt: { gte: today } } }),
      prisma.order.count({ where: { status: "CANCELLED", updatedAt: { gte: today } } })
    ]);

    response.json({
      ok: true,
      summary: {
        activeOrders,
        waitingResponse,
        busyWorkers,
        completedToday,
        cancelledToday,
        cityOverview: []
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/audit-logs", requirePermission("audit.read"), async (request, response, next) => {
  try {
    const result = await listAdminAuditLogs({
      action: readQueryValue(request.query.action),
      actorAdminId: readQueryValue(request.query.actorAdminId),
      actorType:
        readQueryValue(request.query.actorType) === "ENV_ADMIN" || readQueryValue(request.query.actorType) === "ADMIN_ACCOUNT"
          ? readQueryValue(request.query.actorType) as "ENV_ADMIN" | "ADMIN_ACCOUNT"
          : undefined,
      targetType: readQueryValue(request.query.targetType),
      targetId: readQueryValue(request.query.targetId),
      from: readQueryValue(request.query.from),
      to: readQueryValue(request.query.to),
      page: readQueryValue(request.query.page),
      limit: readQueryValue(request.query.limit)
    });

    response.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", requirePermission("users.read"), async (request, response, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    response.json({ ok: true, users });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/workers", requirePermission("workers.read"), async (request, response, next) => {
  try {
    const workers = await prisma.workerProfile.findMany({
      include: { user: true, availability: true },
      orderBy: { createdAt: "desc" }
    });
    response.json({ ok: true, workers });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/orders", requirePermission("orders.read"), async (request, response, next) => {
  try {
    const page = readPositiveInteger(request.query.page, 1);
    const limit = readPositiveInteger(request.query.limit, 20, maxAdminOrdersLimit);
    const where = buildAdminOrdersWhere(request.query);
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          client: true,
          worker: { include: { user: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.order.count({ where })
    ]);

    response.json({
      ok: true,
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/reviews", requirePermission("reviews.read"), async (request, response, next) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        client: true,
        worker: { include: { user: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    response.json({ ok: true, reviews });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/reviews/:reviewId/hide", requirePermission("reviews.manage"), async (request, response, next) => {
  try {
    const reviewId = String(request.params.reviewId);
    const review = await setReviewVisibility(reviewId, ReviewStatus.HIDDEN);
    await auditAdminAction(request, {
      action: "review.hidden",
      targetType: "Review",
      targetId: reviewId,
      metadata: { status: ReviewStatus.HIDDEN }
    });
    response.json({ ok: true, review });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/reviews/:reviewId/restore", requirePermission("reviews.manage"), async (request, response, next) => {
  try {
    const reviewId = String(request.params.reviewId);
    const review = await setReviewVisibility(reviewId, ReviewStatus.PUBLISHED);
    await auditAdminAction(request, {
      action: "review.restored",
      targetType: "Review",
      targetId: reviewId,
      metadata: { status: ReviewStatus.PUBLISHED }
    });
    response.json({ ok: true, review });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/reports", requirePermission("reports.read"), async (request, response, next) => {
  try {
    response.json({ ok: true, reports: await listAdminReports(request.query) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/reports/:reportId", requirePermission("reports.read"), async (request, response, next) => {
  try {
    response.json({ ok: true, report: await getAdminReport(String(request.params.reportId)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/reports/:reportId/status", requirePermission("reports.manage"), async (request, response, next) => {
  try {
    const input = updateReportStatusSchema.parse(request.body);
    const reportId = String(request.params.reportId);
    const report = await updateAdminReport(reportId, request.user!.id, input);
    await auditAdminAction(request, {
      action: reportAuditAction(input.status),
      targetType: "Report",
      targetId: reportId,
      metadata: { status: input.status, hasAdminNote: Boolean(input.adminNote?.trim()) }
    });
    response.json({ ok: true, report });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/support/tickets", requirePermission("support.read"), async (request, response, next) => {
  try {
    response.json({ ok: true, tickets: await listAdminSupportTickets(request.query) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/support/tickets/:ticketId", requirePermission("support.read"), async (request, response, next) => {
  try {
    response.json({ ok: true, ticket: await getAdminSupportTicket(String(request.params.ticketId)) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/support/tickets/:ticketId", requirePermission("support.manage"), async (request, response, next) => {
  try {
    const input = updateSupportTicketSchema.parse(request.body);
    const ticketId = String(request.params.ticketId);
    const ticket = await updateAdminSupportTicket(ticketId, request.user!.id, input);
    await auditAdminAction(request, {
      action: "support.status_updated",
      targetType: "SupportTicket",
      targetId: ticketId,
      metadata: { status: input.status }
    });
    if (input.adminNote !== undefined) {
      await auditAdminAction(request, {
        action: "support.note_updated",
        targetType: "SupportTicket",
        targetId: ticketId,
        metadata: { hasAdminNote: Boolean(input.adminNote?.trim()) }
      });
    }
    response.json({ ok: true, ticket });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:userId/suspend", requirePermission("users.manage"), async (request, response, next) => {
  try {
    const userId = String(request.params.userId);
    if (userId === request.user!.id) {
      throw Object.assign(new Error("Admins cannot suspend their own account"), {
        status: 409,
        code: "ADMIN_SELF_SUSPEND_FORBIDDEN"
      });
    }
    const user = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
      if (!target) throw Object.assign(new Error("User not found"), { status: 404, code: "USER_NOT_FOUND" });
      if (target.role === "ADMIN" || target.role === "SUPER_ADMIN") {
        throw Object.assign(new Error("Admin accounts must be managed from Admins"), {
          status: 403,
          code: "ADMIN_SUSPEND_FORBIDDEN"
        });
      }
      if (target.status === UserStatus.DELETED) {
        throw Object.assign(new Error("Deleted accounts cannot be suspended"), {
          status: 409,
          code: "DELETED_USER_SUSPEND_FORBIDDEN"
        });
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.BLOCKED, sessionVersion: { increment: 1 } }
      });
      await tx.session.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
      return updated;
    });
    response.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:userId/promote-provider", requirePermission("users.manage"), async (request, response, next) => {
  try {
    const input = promoteProviderSchema.parse(request.body);
    const user = await promoteUserToProvider(String(request.params.userId), input);

    response.json({
      ok: true,
      actorId: request.user?.id,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role.toLowerCase(),
        sessionVersion: user.sessionVersion
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/workers/:workerId/approve", requirePermission("workers.manage"), async (request, response, next) => {
  try {
    const input = approveWorkerSchema.parse(request.body);
    const workerId = String(request.params.workerId);
    const worker = await approveWorkerProfile(workerId, input);
    await auditAdminAction(request, {
      action: "worker.approved",
      targetType: "WorkerProfile",
      targetId: workerId,
      metadata: { profession: input.profession, professions: input.professions }
    });

    response.json({
      ok: true,
      actorId: request.user?.id,
      worker
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/workers/:workerId/reject", requirePermission("workers.manage"), async (request, response, next) => {
  try {
    const input = workerModerationSchema.parse(request.body);
    const workerId = String(request.params.workerId);
    const worker = await rejectWorkerProfile(workerId, input.reason);
    await auditAdminAction(request, {
      action: "worker.rejected",
      targetType: "WorkerProfile",
      targetId: workerId,
      metadata: { hasReason: Boolean(input.reason?.trim()) }
    });

    response.json({
      ok: true,
      actorId: request.user?.id,
      worker
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/workers/:workerId/suspend", requirePermission("workers.manage"), async (request, response, next) => {
  try {
    const input = workerModerationSchema.parse(request.body);
    const workerId = String(request.params.workerId);
    const worker = await suspendWorkerProfile(workerId, input.reason);
    await auditAdminAction(request, {
      action: "worker.suspended",
      targetType: "WorkerProfile",
      targetId: workerId,
      metadata: { hasReason: Boolean(input.reason?.trim()) }
    });

    response.json({
      ok: true,
      actorId: request.user?.id,
      worker
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/workers/:workerId/unsuspend", requirePermission("workers.manage"), async (request, response, next) => {
  try {
    const input = workerModerationSchema.parse(request.body);
    const workerId = String(request.params.workerId);
    const worker = await unsuspendWorkerProfile(workerId, input.reason);
    await auditAdminAction(request, {
      action: "worker.unsuspended",
      targetType: "WorkerProfile",
      targetId: workerId,
      metadata: { hasReason: Boolean(input.reason?.trim()) }
    });

    response.json({
      ok: true,
      actorId: request.user?.id,
      worker
    });
  } catch (error) {
    next(error);
  }
});
