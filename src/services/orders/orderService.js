import { TRACKING_STATUSES } from "../../constants/orderTracking";
import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";
import { orderLocationDisplayText } from "./bookingLocation.mjs";

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
    district: order.location?.district || order.cityId,
    address: orderLocationDisplayText(order.location),
    location: order.location || null,
    price: amount ? `${Number(amount).toLocaleString("uz-UZ")} so'm` : "Kelishiladi",
    amount: amount ? `${Number(amount).toLocaleString("uz-UZ")} so'm` : "Kelishiladi",
    status: order.status,
    source: order.source || "CLIENT_APP",
    statusKey: apiToTrackingStatus[order.status] || TRACKING_STATUSES.REQUEST_SENT,
    eta: order.status === "ON_THE_WAY" ? "Yo'lda" : "1 soat ichida",
    createdAt: order.createdAt ? new Date(order.createdAt).getTime() : Date.now(),
    responseDeadlineAt: order.responseDeadlineAt ? new Date(order.responseDeadlineAt).getTime() : undefined,
    cancellationReason: order.cancelReason || null,
    events: order.events || [],
    review: order.review || null
  };
}

export async function createOrderApi(token, draft, service, worker) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/orders", {
      method: "POST",
      token,
      body: {
        workerId: worker.id,
        ...(draft.addressId
          ? { addressId: draft.addressId }
          : draft.location
            ? {
                location: {
                  latitude: draft.location.latitude,
                  longitude: draft.location.longitude,
                  addressText: draft.location.addressText,
                  ...(draft.location.label ? { label: draft.location.label } : {}),
                  ...(draft.location.district ? { district: draft.location.district } : {})
                }
              }
            : {}),
        cityId: worker.cityId || "tashkent",
        categoryId: service?.id,
        serviceType: service?.nameUz || worker.specialty || "Xizmat",
        problemTitle: draft.problemTitle || `${service?.nameUz || worker.specialty || "Xizmat"} buyurtmasi`,
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
    const payload = await httpAuthRequest("/orders?mode=client", { token });
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

export async function submitOrderReviewApi(token, orderId, rating, comment) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest(`/orders/${orderId}/review`, {
      method: "POST",
      token,
      body: {
        rating,
        ...(comment?.trim() ? { comment: comment.trim() } : {})
      }
    });

    return {
      ok: true,
      review: payload.review,
      rating: payload.rating
    };
  });
}
