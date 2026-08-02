import { TRACKING_STATUSES } from "../../constants/orderTracking";
import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";

const apiToTrackingStatus = {
  WAITING_RESPONSE: TRACKING_STATUSES.REQUEST_SENT,
  ACCEPTED: TRACKING_STATUSES.ACCEPTED,
  ON_THE_WAY: TRACKING_STATUSES.ON_THE_WAY,
  IN_PROGRESS: TRACKING_STATUSES.IN_PROGRESS,
  COMPLETED: TRACKING_STATUSES.COMPLETED,
  CANCELLED: TRACKING_STATUSES.CANCELLED
};

const urgencyToApi = {
  normal: "NORMAL",
  fast: "FAST",
  urgent: "URGENT"
};

export function mapApiOrder(order) {
  const workerName = order.worker?.user?.name || order.worker?.profession || "NearFIX usta";
  const service = order.serviceType || "Xizmat";
  const amount = order.finalAmount || order.priceEstimate;

  return {
    id: order.id,
    publicCode: order.publicCode,
    title: order.problemTitle || `${service} buyurtmasi`,
    problemTitle: order.problemTitle || `${service} buyurtmasi`,
    service,
    clientName: order.client?.name || "Mijoz",
    clientPhone: order.client?.phone,
    workerId: order.workerId,
    provider: workerName,
    date: new Date(order.createdAt).toLocaleDateString("uz-UZ"),
    district: order.address?.district || order.cityId,
    address: order.address?.addressText || "Manzil kiritilgan",
    price: amount ? `${Number(amount).toLocaleString("uz-UZ")} so'm` : "Kelishiladi",
    amount: amount ? `${Number(amount).toLocaleString("uz-UZ")} so'm` : "Kelishiladi",
    status: order.status,
    statusKey: apiToTrackingStatus[order.status] || TRACKING_STATUSES.REQUEST_SENT,
    eta: order.status === "ON_THE_WAY" ? "Yo'lda" : "1 soat ichida",
    createdAt: order.createdAt ? new Date(order.createdAt).getTime() : Date.now(),
    responseDeadlineAt: order.responseDeadlineAt ? new Date(order.responseDeadlineAt).getTime() : undefined,
    events: order.events || []
  };
}

export async function createOrderApi(token, draft, service, worker) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/orders", {
      method: "POST",
      token,
      body: {
        workerId: worker.id,
        addressId: draft.addressId || undefined,
        cityId: worker.cityId || "tashkent",
        serviceType: service?.title || worker.specialty || "Xizmat",
        problemTitle: draft.problemTitle || `${service?.title || "Xizmat"} buyurtmasi`,
        problemDescription: draft.description || undefined,
        urgency: urgencyToApi[draft.urgency] || "FAST",
        priceEstimate: worker.basePriceValue || undefined
      }
    });

    return {
      ok: true,
      order: mapApiOrder(payload.order),
      raw: payload.order
    };
  });
}

export async function fetchOrdersApi(token) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/orders", { token });
    return {
      ok: true,
      orders: (payload.orders || []).map(mapApiOrder)
    };
  });
}

export async function cancelOrderApi(token, orderId, reason) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest(`/orders/${orderId}/cancel`, {
      method: "POST",
      token,
      body: { reason }
    });

    return {
      ok: true,
      order: mapApiOrder(payload.order)
    };
  });
}
