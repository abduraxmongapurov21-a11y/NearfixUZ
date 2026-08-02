import { OrderStatus, ReportReason, ReportStatus, ReportTargetType, UserStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";
import { getOrderForUser } from "../orders/order.service.js";

const activeReportStatuses = [ReportStatus.PENDING, ReportStatus.REVIEWING];

type CreateReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: Prisma.ReportCreateInput["reason"];
  details?: string;
};

async function validateReportTarget(user: AuthUser, input: CreateReportInput) {
  switch (input.targetType) {
    case ReportTargetType.USER: {
      if (input.targetId === user.id) {
        throw Object.assign(new Error("You cannot report yourself"), {
          status: 400,
          code: "REPORT_SELF_FORBIDDEN"
        });
      }
      const target = await prisma.user.findFirst({
        where: { id: input.targetId, status: { not: UserStatus.DELETED } },
        select: { id: true }
      });
      if (!target) throw Object.assign(new Error("User not found"), { status: 404, code: "REPORT_TARGET_NOT_FOUND" });
      return;
    }
    case ReportTargetType.WORKER: {
      const worker = await prisma.workerProfile.findFirst({
        where: { id: input.targetId, user: { status: { not: UserStatus.DELETED } } },
        select: { userId: true }
      });
      if (!worker) throw Object.assign(new Error("Worker not found"), { status: 404, code: "REPORT_TARGET_NOT_FOUND" });
      if (worker.userId === user.id) {
        throw Object.assign(new Error("You cannot report yourself"), {
          status: 400,
          code: "REPORT_SELF_FORBIDDEN"
        });
      }
      return;
    }
    case ReportTargetType.MESSAGE: {
      const message = await prisma.chatMessage.findUnique({
        where: { id: input.targetId },
        select: {
          senderId: true,
          room: { select: { participants: { where: { userId: user.id }, select: { userId: true } } } }
        }
      });
      if (!message || !message.room?.participants.length) {
        throw Object.assign(new Error("Message not found"), { status: 404, code: "REPORT_TARGET_NOT_FOUND" });
      }
      if (message.senderId === user.id) {
        throw Object.assign(new Error("You cannot report your own message"), {
          status: 400,
          code: "REPORT_SELF_FORBIDDEN"
        });
      }
      return;
    }
    case ReportTargetType.REVIEW: {
      const review = await prisma.review.findUnique({
        where: { id: input.targetId },
        select: { clientId: true }
      });
      if (!review) throw Object.assign(new Error("Review not found"), { status: 404, code: "REPORT_TARGET_NOT_FOUND" });
      if (review.clientId === user.id) {
        throw Object.assign(new Error("You cannot report your own review"), {
          status: 400,
          code: "REPORT_SELF_FORBIDDEN"
        });
      }
      return;
    }
    case ReportTargetType.ORDER:
      await getOrderForUser(user, input.targetId);
      return;
    case ReportTargetType.SUPPORT_TICKET: {
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: input.targetId, userId: user.id },
        select: { id: true }
      });
      if (!ticket) throw Object.assign(new Error("Support ticket not found"), { status: 404, code: "REPORT_TARGET_NOT_FOUND" });
      return;
    }
  }
}

export async function createReport(user: AuthUser, input: CreateReportInput) {
  await validateReportTarget(user, input);

  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: activeReportStatuses }
    },
    select: { id: true }
  });

  if (duplicate) {
    throw Object.assign(new Error("This report is already under review"), {
      status: 409,
      code: "ACTIVE_REPORT_EXISTS"
    });
  }

  return prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details?.trim() || null
    }
  });
}

function reportWhere(query: Record<string, unknown>): Prisma.ReportWhereInput {
  const status = typeof query.status === "string" && Object.values(ReportStatus).includes(query.status as ReportStatus)
    ? query.status as ReportStatus
    : undefined;
  const targetType =
    typeof query.targetType === "string" && Object.values(ReportTargetType).includes(query.targetType as ReportTargetType)
      ? query.targetType as ReportTargetType
      : undefined;
  const reason =
    typeof query.reason === "string" && Object.values(ReportReason).includes(query.reason as ReportReason)
      ? (query.reason as ReportReason)
      : undefined;
  const search = typeof query.search === "string" ? query.search.trim() : "";

  return {
    ...(status ? { status } : {}),
    ...(targetType ? { targetType } : {}),
    ...(reason ? { reason } : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { targetId: { contains: search, mode: "insensitive" } },
            { details: { contains: search, mode: "insensitive" } },
            { reporter: { name: { contains: search, mode: "insensitive" } } },
            { reporter: { phone: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };
}

export async function listAdminReports(query: Record<string, unknown>) {
  return prisma.report.findMany({
    where: reportWhere(query),
    include: {
      reporter: { select: { id: true, name: true, phone: true, role: true, status: true } },
      resolvedByAdmin: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

async function loadTargetContext(targetType: ReportTargetType, targetId: string) {
  switch (targetType) {
    case ReportTargetType.USER:
      return prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, phone: true, role: true, status: true, createdAt: true }
      });
    case ReportTargetType.WORKER:
      return prisma.workerProfile.findUnique({
        where: { id: targetId },
        include: { user: { select: { id: true, name: true, phone: true, status: true } } }
      });
    case ReportTargetType.MESSAGE:
      return prisma.chatMessage.findUnique({
        where: { id: targetId },
        select: { id: true, roomId: true, orderId: true, senderId: true, type: true, body: true, mediaId: true, createdAt: true }
      });
    case ReportTargetType.REVIEW:
      return prisma.review.findUnique({
        where: { id: targetId },
        include: {
          client: { select: { id: true, name: true, phone: true, status: true } },
          worker: { include: { user: { select: { id: true, name: true, phone: true, status: true } } } }
        }
      });
    case ReportTargetType.ORDER:
      return prisma.order.findUnique({
        where: { id: targetId },
        include: {
          client: { select: { id: true, name: true, phone: true, status: true } },
          worker: { include: { user: { select: { id: true, name: true, phone: true, status: true } } } }
        }
      });
    case ReportTargetType.SUPPORT_TICKET:
      return prisma.supportTicket.findUnique({
        where: { id: targetId },
        include: { user: { select: { id: true, name: true, phone: true, status: true } } }
      });
  }
}

export async function getAdminReport(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, name: true, phone: true, role: true, status: true } },
      resolvedByAdmin: { select: { id: true, name: true } }
    }
  });
  if (!report) throw Object.assign(new Error("Report not found"), { status: 404, code: "REPORT_NOT_FOUND" });

  return {
    ...report,
    target: await loadTargetContext(report.targetType, report.targetId)
  };
}

export async function updateAdminReport(
  reportId: string,
  adminId: string,
  input: { status: ReportStatus; adminNote?: string }
) {
  const existing = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true } });
  if (!existing) throw Object.assign(new Error("Report not found"), { status: 404, code: "REPORT_NOT_FOUND" });

  const resolverUserId = adminId === "env-admin" ? null : adminId;
  const terminal =
    input.status === ReportStatus.RESOLVED ||
    input.status === ReportStatus.DISMISSED ||
    input.status === ReportStatus.ACTION_TAKEN;
  return prisma.report.update({
    where: { id: reportId },
    data: {
      status: input.status,
      adminNote: input.adminNote?.trim() || null,
      resolvedByAdminId: terminal ? resolverUserId : null,
      resolvedAt: terminal ? new Date() : null
    }
  });
}

export async function hasActiveOrderBetweenUsers(firstUserId: string, secondUserId: string) {
  return prisma.order.findFirst({
    where: {
      status: { in: [OrderStatus.CREATED, OrderStatus.WAITING_RESPONSE, OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY, OrderStatus.IN_PROGRESS] },
      OR: [
        { clientId: firstUserId, worker: { userId: secondUserId } },
        { clientId: secondUserId, worker: { userId: firstUserId } }
      ]
    },
    select: { id: true }
  });
}
