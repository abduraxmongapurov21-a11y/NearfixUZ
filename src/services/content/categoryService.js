import { apiRequest, httpRequest } from "../api/client";
import { mapApiCategory } from "./categoryModel.mjs";
export { categoryName, findCategoryByLegacyValue, mapApiCategory, workerCategoryLabel } from "./categoryModel.mjs";

export async function fetchCategoriesApi() {
  return apiRequest(
    async () => {
      const payload = await httpRequest("/content/categories");
      return { ok: true, categories: (payload.categories || []).map(mapApiCategory) };
    },
    (error) => ({ ok: false, categories: [], code: error?.code, message: error?.message })
  );
}
