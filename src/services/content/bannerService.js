import { apiRequest, httpRequest } from "../api/client";
import { mapApiBanner } from "./bannerModel.mjs";
export { mapApiBanner } from "./bannerModel.mjs";

export async function fetchBannersApi(placement = "HOME") {
  return apiRequest(
    async () => {
      const payload = await httpRequest(`/content/banners?placement=${encodeURIComponent(placement)}`);
      return {
        ok: true,
        banners: (payload.banners || []).map(mapApiBanner)
      };
    },
    () => ({
      ok: true,
      banners: []
    })
  );
}
