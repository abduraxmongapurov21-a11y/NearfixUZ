export type AdminAuditLog = {
  id: string;
  actorAdminId: string | null;
  actorType: "ENV_ADMIN" | "ADMIN_ACCOUNT";
  actorUsername?: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminAuditLogsQuery = {
  action?: string;
  actorType?: "ENV_ADMIN" | "ADMIN_ACCOUNT" | "";
  targetType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type AdminAuditLogsResult = {
  logs: AdminAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
