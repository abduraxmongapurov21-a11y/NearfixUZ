import { apiClient } from "./api-client";
import { hasPermission, type AdminSessionLike } from "@/shared/auth/permissions";

export type AdminNotification = { id: string; title: string; href: string; createdAt: string };

// Reuse the existing operational queues; no separate notification identity is
// required for an environment admin or an independent admin-account record.
export async function getAdminNotifications(session: AdminSessionLike & { token: string }) {
  const requests: Promise<AdminNotification[]>[] = [];
  if (hasPermission(session, "orders.read")) requests.push(
    apiClient<{ items: { id: string; publicCode?: string; problemTitle: string; createdAt: string }[] }>(
      "/admin/orders?status=waiting&limit=5", { token: session.token }
    ).then(({ items }) => items.map((order) => ({
      id: `order-${order.id}`, title: `Javob kutilmoqda: ${order.publicCode || order.problemTitle}`, href: "/orders", createdAt: order.createdAt
    })))
  );
  if (hasPermission(session, "support.read")) requests.push(
    apiClient<{ tickets: { id: string; reason: string; createdAt: string }[] }>(
      "/admin/support/tickets?status=OPEN", { token: session.token }
    ).then(({ tickets }) => tickets.slice(0, 5).map((ticket) => ({
      id: `support-${ticket.id}`, title: `Yordam: ${ticket.reason}`, href: "/support", createdAt: ticket.createdAt
    })))
  );
  if (hasPermission(session, "reports.read")) requests.push(
    apiClient<{ reports: { id: string; reason: string; createdAt: string }[] }>(
      "/admin/reports?status=PENDING", { token: session.token }
    ).then(({ reports }) => reports.slice(0, 5).map((report) => ({
      id: `report-${report.id}`, title: "Ko'rib chiqilmagan shikoyat", href: "/reports", createdAt: report.createdAt
    })))
  );
  const results = await Promise.allSettled(requests);
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  items.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id));
  return { items, hasError: results.some((result) => result.status === "rejected") };
}
