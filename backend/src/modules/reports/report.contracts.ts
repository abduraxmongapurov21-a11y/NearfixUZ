import { ReportReason, ReportStatus, ReportTargetType } from "@prisma/client";
import { z } from "zod";

export const createReportSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: z.string().min(1).max(128),
  reason: z.nativeEnum(ReportReason),
  details: z.string().trim().min(3).max(1000).optional()
});

export const updateReportStatusSchema = z.object({
  status: z.nativeEnum(ReportStatus),
  adminNote: z.string().trim().max(2000).optional()
});
