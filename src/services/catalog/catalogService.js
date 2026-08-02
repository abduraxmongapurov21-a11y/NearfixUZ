import { apiRequest, httpRequest } from "../api/client";
import { normalizeDistanceMeters } from "./catalogDistance.mjs";

function mapAvailability(status) {
  return String(status || "OFFLINE").toLowerCase();
}

export function mapApiWorker(worker) {
  const professions = Array.isArray(worker.professions) && worker.professions.length
    ? worker.professions
    : worker.profession
      ? [worker.profession]
      : ["Xizmat"];
  const name = worker.user?.name || worker.profession || "NearFIX usta";
  const price = worker.basePrice ? `${Number(worker.basePrice).toLocaleString("uz-UZ")} so'm` : "Kelishiladi";

  return {
    id: worker.id,
    userId: worker.userId,
    phone: worker.user?.phone,
    name,
    specialty: worker.profession || professions[0] || "Usta",
    professions,
    profileImageUrl: worker.profileImageUrl,
    rating: String(worker.ratingAvg || "0"),
    reviews: worker.completedOrdersCount || 0,
    completedOrders: worker.completedOrdersCount || 0,
    responseSpeed: "Odatda 1 soat ichida javob beradi",
    workingHours: "09:00 - 21:00",
    availability: mapAvailability(worker.availability?.status),
    verification: worker.verifiedAt ? "NearFIX tasdiqlagan" : "Tekshiruvda",
    guarantee: "NearFIX kafolati ostida",
    distanceMeters: normalizeDistanceMeters(worker.distanceMeters),
    cityId: worker.user?.cityId || "",
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

export async function fetchCatalogWorkers(cityId, profession, options = {}) {
  return apiRequest(
    async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (profession) params.set("profession", profession);
      if (options.originAddressId) params.set("originAddressId", options.originAddressId);
      if (options.sort === "nearest") params.set("sort", "nearest");
      const query = params.toString() ? `?${params.toString()}` : "";
      const payload = await httpRequest(`/workers/catalog${query}`, { token: options.token });

      return {
        ok: true,
        workers: (payload.workers || []).map(mapApiWorker),
        source: "api"
      };
    }
  );
}
