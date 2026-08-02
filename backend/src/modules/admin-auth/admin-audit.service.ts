import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export type AdminAuditActorType = "ENV_ADMIN" | "ADMIN_ACCOUNT";

type WriteAdminAuditInput = {
  actorType: AdminAuditActorType;
  actorAdminId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function sanitizeAdminAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        const normalizedKey = key.toLowerCase();
        if (
          normalizedKey.includes("password") ||
          normalizedKey.includes("token") ||
          normalizedKey.includes("secret") ||
          normalizedKey.includes("authorization")
        ) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeAdminAuditValue(nestedValue)];
      })
    );
  }

  return value;
}

function sanitizeValue(value: unknown): unknown {
  return sanitizeAdminAuditValue(value);
}

export async function writeAdminAuditLog(input: WriteAdminAuditInput) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorType: input.actorType,
        actorAdminId: input.actorAdminId || null,
        action: input.action,
        targetType: input.targetType || null,
        targetId: input.targetId || null,
        metadata: input.metadata ? sanitizeValue(input.metadata) as Prisma.InputJsonValue : undefined,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null
      }
    });
  } catch (error) {
    console.warn(`[admin-audit] failed to write ${input.action}: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

export type ListAdminAuditLogsQuery = {
  action?: string;
  actorAdminId?: string;
  actorType?: "ENV_ADMIN" | "ADMIN_ACCOUNT";
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
  page?: string | number;
  limit?: string | number;
};

function readPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function listAdminAuditLogs(query: ListAdminAuditLogsQuery) {
  const page = readPositiveInteger(query.page, 1, 10_000);
  const limit = readPositiveInteger(query.limit, 50, 100);
  const from = parseDate(query.from);
  const to = parseDate(query.to);

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorAdminId ? { actorAdminId: query.actorAdminId } : {}),
    ...(query.actorType ? { actorType: query.actorType } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
  };

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      include: {
        actorAdmin: { select: { username: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.adminAuditLog.count({ where })
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      actorAdminId: log.actorAdminId,
      actorType: log.actorType,
      actorUsername: log.actorAdmin?.username || null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata ? sanitizeAdminAuditValue(log.metadata) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}
