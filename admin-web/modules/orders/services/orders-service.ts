import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminOrder, AdminOrderDetail, City, OrderStatus } from "@/contracts/admin";

export type AdminOrdersQuery = {
  status?: string;
  cityId?: string;
  workerId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type AdminOrdersResult = {
  items: AdminOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminOrderAction =
  | "accept"
  | "on_the_way"
  | "in_progress"
  | "completed"
  | "cancel";

function mapStatus(status: string): OrderStatus {
  const value = status.toLowerCase();
  if (value === "waiting_response" || value === "created") return "waiting";
  if (value === "accepted" || value === "on_the_way" || value === "in_progress") return "active";
  if (value === "completed") return "completed";
  if (value === "cancelled") return "cancelled";
  return "waiting";
}

function mapOrder(order: any): AdminOrder {
  return {
    orderId: order.id,
    id: order.publicCode || order.id,
    client: order.client?.name || order.client?.phone || "Client",
    worker: order.worker?.user?.name || order.worker?.profession || "Worker",
    city: (order.cityId || "Tashkent") as City,
    service: order.serviceType,
    status: mapStatus(String(order.status || "")),
    createdAt: new Date(order.createdAt).toLocaleString("uz-UZ"),
    amount: order.finalAmount || order.priceEstimate || 0
  };
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("uz-UZ") : null;
}

function mapOrderDetail(order: any): AdminOrderDetail {
  return {
    id: order.id,
    publicCode: order.publicCode || order.id,
    status: String(order.status || ""),
    createdAt: formatDate(order.createdAt) || "",
    client: {
      id: order.client?.id || order.clientId || "",
      name: order.client?.name || order.client?.phone || "Client",
      phone: order.client?.phone || ""
    },
    worker: {
      id: order.worker?.id || order.workerId || "",
      name: order.worker?.user?.name || order.worker?.user?.phone || order.worker?.profession || "Worker",
      phone: order.worker?.user?.phone || "",
      profession: order.worker?.profession || "",
      availability: String(order.worker?.availability?.status || "")
    },
    address: order.address
      ? {
          label: order.address.label || "Manzil",
          cityId: order.address.cityId || order.cityId || "",
          district: order.address.district || undefined,
          addressText: order.address.addressText || "",
          lat: order.address.lat ? String(order.address.lat) : undefined,
          lng: order.address.lng ? String(order.address.lng) : undefined
        }
      : null,
    city: (order.cityId || "Tashkent") as City,
    service: order.serviceType || "",
    problemTitle: order.problemTitle || "",
    problemDescription: order.problemDescription || undefined,
    priceEstimate: order.priceEstimate ?? null,
    finalAmount: order.finalAmount ?? null,
    responseDeadline: formatDate(order.responseDeadlineAt),
    cancelReason: order.cancelReason || null,
    payments: (order.payments || []).map((payment: any) => ({
      id: payment.id,
      provider: String(payment.provider || ""),
      status: String(payment.status || ""),
      amount: payment.amount || 0,
      externalId: payment.externalId || undefined,
      createdAt: formatDate(payment.createdAt) || "",
      updatedAt: formatDate(payment.updatedAt) || ""
    })),
    timeline: (order.events || []).map((event: any) => ({
      id: event.id,
      actorType: String(event.actorType || ""),
      eventType: String(event.eventType || ""),
      fromStatus: event.fromStatus || undefined,
      toStatus: event.toStatus || undefined,
      message: event.message || undefined,
      createdAt: formatDate(event.createdAt) || ""
    }))
  };
}

function buildQueryString(query: AdminOrdersQuery) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const value = params.toString();
  return value ? `?${value}` : "";
}

export async function getOrders(query: AdminOrdersQuery = {}): Promise<AdminOrdersResult> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin authentication required");

  const payload = await apiClient<{
    ok: boolean;
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/admin/orders${buildQueryString(query)}`, { token });

  return {
    items: payload.items.map(mapOrder),
    total: payload.total,
    page: payload.page,
    limit: payload.limit,
    totalPages: payload.totalPages
  };
}

export async function getOrderDetail(orderId: string): Promise<AdminOrderDetail> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin authentication required");

  const payload = await apiClient<{ ok: boolean; order: any }>(`/orders/${orderId}`, { token });
  return mapOrderDetail(payload.order);
}

export async function runOrderAction(orderId: string, action: AdminOrderAction) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token mavjud emas");

  if (action === "accept") {
    await apiClient<{ ok: boolean; order: any }>(`/orders/${orderId}/accept`, {
      method: "POST",
      token
    });
    return;
  }

  if (action === "cancel") {
    await apiClient<{ ok: boolean; order: any }>(`/orders/${orderId}/cancel`, {
      body: JSON.stringify({ reason: "Cancelled by admin" }),
      method: "POST",
      token
    });
    return;
  }

  const statusByAction: Record<Exclude<AdminOrderAction, "accept" | "cancel">, string> = {
    on_the_way: "ON_THE_WAY",
    in_progress: "IN_PROGRESS",
    completed: "COMPLETED"
  };

  await apiClient<{ ok: boolean; order: any }>(`/orders/${orderId}/status`, {
    body: JSON.stringify({ status: statusByAction[action] }),
    method: "POST",
    token
  });
}
