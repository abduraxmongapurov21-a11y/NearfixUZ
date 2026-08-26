export const CATEGORY_CACHE_VERSION = 1;

export const initialCategoryAvailability = Object.freeze({
  categories: [],
  status: "idle",
  error: null,
  lastLoadedAt: null,
  refreshing: false
});

export function categoryAvailabilityFromCache(payload) {
  if (payload?.version !== CATEGORY_CACHE_VERSION || !Array.isArray(payload.categories) || !Number.isFinite(payload.lastLoadedAt)) {
    return null;
  }
  return {
    categories: payload.categories,
    status: payload.categories.length ? "ready" : "empty",
    error: null,
    lastLoadedAt: payload.lastLoadedAt,
    refreshing: false
  };
}

export function categoryAvailabilityLoading(current) {
  if (current.lastLoadedAt !== null) return { ...current, refreshing: true, error: null };
  return { ...current, status: "loading", refreshing: true, error: null };
}

export function categoryAvailabilitySuccess(categories, loadedAt = Date.now()) {
  return {
    categories,
    status: categories.length ? "ready" : "empty",
    error: null,
    lastLoadedAt: loadedAt,
    refreshing: false
  };
}

export function categoryAvailabilityFailure(current, message) {
  if (current.lastLoadedAt !== null) return { ...current, error: message, refreshing: false };
  return { ...current, categories: [], status: "error", error: message, refreshing: false };
}

export function categoryCachePayload(state) {
  return { version: CATEGORY_CACHE_VERSION, categories: state.categories, lastLoadedAt: state.lastLoadedAt };
}

export function resolveCategoryRoute(state, requestedCategoryId, fallbackToFirst = true) {
  if ((state.status === "idle" || state.status === "loading") && state.lastLoadedAt === null) return { kind: "pending" };
  if (state.status === "error") return { kind: "unavailable", reason: "error" };
  if (state.status === "empty") return { kind: "unavailable", reason: "empty" };
  const categoryId = requestedCategoryId || (fallbackToFirst ? state.categories[0]?.id : undefined);
  const category = state.categories.find((item) => item.id === categoryId);
  return category ? { kind: "ready", categoryId, category } : { kind: "unavailable", reason: "invalid" };
}
