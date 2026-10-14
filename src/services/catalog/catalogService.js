import { ApiError, apiRequest, httpRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";
import { hasAddressCoordinates, normalizeDistanceMeters } from "./catalogDistance.mjs";

function mapAvailability(status) {
  return String(status || "OFFLINE").toLowerCase();
}

export function mapApiWorker(worker) {
  const professions = Array.isArray(worker.professions) && worker.professions.length
    ? worker.professions
    : worker.profession
      ? [worker.profession]
      : ["Xizmat"];
  const name = worker.name || worker.user?.name || worker.profession || "NearFIX usta";
  const price = worker.basePrice ? `${Number(worker.basePrice).toLocaleString("uz-UZ")} so'm` : "Kelishiladi";

  return {
    id: worker.id,
    name,
    phone: worker.phone,
    specialty: worker.profession || professions[0] || "Usta",
    professions,
    categoryIds: Array.isArray(worker.categoryIds) ? worker.categoryIds : [],
    categories: Array.isArray(worker.categories) ? worker.categories : [],
    profileImageUrl: worker.profileImageUrl,
    rating: String(worker.ratingAvg || "0"),
    reviews: worker.completedOrdersCount || 0,
    completedOrders: worker.completedOrdersCount || 0,
    responseSpeed: "Odatda 1 soat ichida javob beradi",
    workingHours: "09:00 - 21:00",
    availability: mapAvailability(worker.availability?.status),
    verification: "NearFIX tasdiqlagan",
    guarantee: "NearFIX kafolati ostida",
    distanceMeters: normalizeDistanceMeters(worker.distanceMeters),
    basePriceValue: worker.basePrice || 0,
    experience: worker.experienceYears ? `${worker.experienceYears} yil` : "Tasdiqlangan",
    price,
    image: undefined,
    about: worker.bio || "NearFIX tomonidan tekshirilgan xizmat ko'rsatuvchi.",
    services: professions.map((professionName) => [professionName, price]),
    gallery: [],
    customerReviews: [],
    relatedServices: professions
  };
}

export async function fetchCatalogWorkers(categoryId, options = {}) {
  return apiRequest(
    async () => {
      const params = new URLSearchParams();
      if (categoryId) params.set("categoryId", categoryId);
      if (options.originCoordinates) {
        if (!hasAddressCoordinates(options.originCoordinates)) throw new ApiError("Invalid origin coordinates", 400, "ORIGIN_COORDINATES_INVALID");
        params.set("originLat", String(options.originCoordinates.lat ?? options.originCoordinates.latitude));
        params.set("originLng", String(options.originCoordinates.lng ?? options.originCoordinates.longitude));
      } else if (options.originAddressId) params.set("originAddressId", options.originAddressId);
      if (options.sort === "nearest") params.set("sort", "nearest");
      const query = params.toString() ? `?${params.toString()}` : "";
      const payload = options.token
        ? await httpAuthRequest(`/workers/catalog${query}`, { token: options.token })
        : await httpRequest(`/workers/catalog${query}`);

      return {
        ok: true,
        workers: (payload.workers || []).map(mapApiWorker),
        source: "api"
      };
    }
  );
}

export async function fetchPublicWorker(workerId) {
  return apiRequest(async () => {
    const payload = await httpRequest(`/workers/${encodeURIComponent(workerId)}`);
    return { ok: true, worker: mapApiWorker(payload.worker), source: "api" };
  });
}
