import { create } from "zustand";
import { DEFAULT_CATALOG_FILTERS } from "../constants/catalog";
import { ORDER_STATES } from "../constants/orderStates";
import { TRACKING_STATUSES } from "../constants/orderTracking";
import { fetchCatalogWorkers } from "../services/catalog/catalogService";
import { resolveCatalogOriginAddressId, shouldApplyCatalogResponse } from "../services/catalog/catalogDistance.mjs";
import { cancelOrderApi, createOrderApi, fetchOrdersApi } from "../services/orders/orderService";
import { createAddressApi, deleteAddressApi, getAddressesApi, updateAddressApi } from "../services/addresses/addressService";
import { fetchBannersApi } from "../services/content/bannerService";
import { fetchCategoriesApi } from "../services/content/categoryService";
import { loadCategoryCache, saveCategoryCache } from "../services/content/categoryCache";
import { categoryAvailabilityFailure, categoryAvailabilityLoading, categoryAvailabilitySuccess, categoryCachePayload } from "../services/content/categoryAvailability.mjs";
import { addFavoriteApi, fetchFavoritesApi, removeFavoriteApi } from "../services/favorites/favoriteService";
import { useAuthStore } from "./authStore";
import { registerSessionResetHandler } from "./sessionReset";
import { reconcileCatalogAddressState, replaceOptimisticAddress, replaceUpdatedAddress } from "./clientAddressState.mjs";
import { createAccountRequestGuard } from "./requestGeneration.mjs";

const initialUser = {
  id: null,
  name: null,
  location: null,
  avatarInitials: null
};

const initialOrderDraft = {
  serviceId: null,
  problemTitle: "",
  description: "",
  urgency: "fast",
  photos: [],
  addressId: null,
  address: "",
  location: null,
  useCurrentLocation: false,
  selectedWorkerId: null,
  status: ORDER_STATES.CREATED
};

let catalogRequestSequence = 0;
const clientRequestGuard = createAccountRequestGuard();

const defaultClientStoreDependencies = {
  getSession: () => useAuthStore.getState().session,
  getAddressesApi,
  fetchFavoritesApi,
  addFavoriteApi,
  removeFavoriteApi,
  createAddressApi,
  updateAddressApi,
  deleteAddressApi,
  fetchOrdersApi,
  createOrderApi,
  cancelOrderApi,
  fetchCatalogWorkers,
  fetchCategoriesApi,
  loadCategoryCache,
  saveCategoryCache
};
const clientStoreDependencies = { ...defaultClientStoreDependencies };

export function configureClientStoreForTests(overrides = {}) {
  Object.assign(clientStoreDependencies, overrides);
  return () => Object.assign(clientStoreDependencies, defaultClientStoreDependencies);
}

function currentAccountId() {
  return clientStoreDependencies.getSession()?.userId || null;
}

let categorySyncPromise = null;

export const useClientStore = create((set, get) => ({
  user: initialUser,
  categories: [],
  topCategoryIds: [],
  categoryStatus: "idle",
  categoryError: null,
  categoryRefreshing: false,
  categoriesLastLoadedAt: null,
  categoryCacheHydrated: false,
  workers: [],
  banners: [],
  orders: [],
  activeOrder: null,
  chatMessages: [],
  savedAddresses: [],
  addressStatus: {
    loading: false,
    saving: false,
    error: null
  },
  favoriteWorkerIds: [],
  apiStatus: {
    catalogSource: "mock",
    ordersSource: "mock",
    lastError: null
  },
  catalogQuery: "",
  catalogOriginAddressId: null,
  catalogSort: "recommended",
  catalogLoading: false,
  catalogRequestVersion: 0,
  catalogFilters: DEFAULT_CATALOG_FILTERS,
  selectedWorkerId: null,
  orderDraft: initialOrderDraft,
  clearUserData: () => {
    clientRequestGuard.invalidateSession();
    set({
      user: initialUser,
      workers: [],
      orders: [],
      activeOrder: null,
      chatMessages: [],
      savedAddresses: [],
      favoriteWorkerIds: [],
      selectedWorkerId: null,
      catalogOriginAddressId: null,
      catalogSort: "recommended",
      catalogLoading: false,
      catalogRequestVersion: 0,
      orderDraft: initialOrderDraft,
      addressStatus: {
        loading: false,
        saving: false,
        error: null
      }
    });
  },
  setCatalogOriginAddressId: (addressId) =>
    set((state) => {
      const resolvedAddressId = resolveCatalogOriginAddressId(addressId, state.savedAddresses);
      return {
        catalogOriginAddressId: resolvedAddressId,
        catalogSort: !resolvedAddressId && state.catalogSort === "nearest" ? "recommended" : state.catalogSort
      };
    }),
  setCatalogSort: (sort) =>
    set((state) => {
      const requestedSort = ["recommended", "nearest", "rating", "price"].includes(sort) ? sort : "recommended";
      return {
        catalogSort: requestedSort === "nearest" && !state.catalogOriginAddressId ? "recommended" : requestedSort
      };
    }),
  syncCategoriesFromApi: async () => {
    if (categorySyncPromise) return categorySyncPromise;
    categorySyncPromise = (async () => {
      if (!get().categoryCacheHydrated) {
        const cached = await clientStoreDependencies.loadCategoryCache();
        set({
          ...(cached
            ? {
                categories: cached.categories,
                topCategoryIds: cached.categories.map((category) => category.id),
                categoryStatus: cached.status,
                categoryError: null,
                categoryRefreshing: false,
                categoriesLastLoadedAt: cached.lastLoadedAt
              }
            : {}),
          categoryCacheHydrated: true
        });
      }

      const loading = categoryAvailabilityLoading({
        categories: get().categories,
        status: get().categoryStatus,
        error: get().categoryError,
        lastLoadedAt: get().categoriesLastLoadedAt,
        refreshing: get().categoryRefreshing
      });
      set({ categoryStatus: loading.status, categoryError: loading.error, categoryRefreshing: loading.refreshing });

      const result = await clientStoreDependencies.fetchCategoriesApi();
      if (result.ok) {
        const next = categoryAvailabilitySuccess(result.categories);
        set({
          categories: next.categories,
          topCategoryIds: next.categories.map((category) => category.id),
          categoryStatus: next.status,
          categoryError: next.error,
          categoryRefreshing: next.refreshing,
          categoriesLastLoadedAt: next.lastLoadedAt
        });
        await clientStoreDependencies.saveCategoryCache(categoryCachePayload(next));
      } else {
        const next = categoryAvailabilityFailure({
          categories: get().categories,
          status: get().categoryStatus,
          error: get().categoryError,
          lastLoadedAt: get().categoriesLastLoadedAt,
          refreshing: get().categoryRefreshing
        }, result.message || "Kategoriyalar yuklanmadi");
        set({
          categories: next.categories,
          topCategoryIds: next.categories.map((category) => category.id),
          categoryStatus: next.status,
          categoryError: next.error,
          categoryRefreshing: next.refreshing,
          categoriesLastLoadedAt: next.lastLoadedAt
        });
      }
      return result;
    })().finally(() => { categorySyncPromise = null; });
    return categorySyncPromise;
  },
  syncCatalogFromApi: async (categoryId) => {
    const stateAtRequest = get();
    const originAddressId = resolveCatalogOriginAddressId(
      stateAtRequest.catalogOriginAddressId,
      stateAtRequest.savedAddresses
    );
    const selectedSort = ["recommended", "nearest", "rating", "price"].includes(stateAtRequest.catalogSort)
      ? stateAtRequest.catalogSort
      : "recommended";
    const catalogSort = selectedSort === "nearest" && !originAddressId ? "recommended" : selectedSort;
    const requestSort = catalogSort === "nearest" ? "nearest" : "recommended";
    const requestVersion = ++catalogRequestSequence;
    const token = useAuthStore.getState().session?.token;

    set({
      catalogOriginAddressId: originAddressId,
      catalogSort,
      catalogLoading: true,
      catalogRequestVersion: requestVersion
    });

    const result = await clientStoreDependencies.fetchCatalogWorkers(categoryId, {
      originAddressId,
      sort: requestSort,
      token
    });

    if (!shouldApplyCatalogResponse(requestVersion, get().catalogRequestVersion)) return { ...result, stale: true };

    if (result.ok) {
      set((state) => ({
        workers: result.workers,
        selectedWorkerId: result.workers.some((worker) => worker.id === state.selectedWorkerId)
          ? state.selectedWorkerId
          : result.workers[0]?.id || null,
        apiStatus: {
          ...state.apiStatus,
          catalogSource: result.source || "api",
          lastError: null
        },
        catalogLoading: false
      }));
    } else {
      set((state) => ({
        catalogLoading: false,
        apiStatus: {
          ...state.apiStatus,
          lastError: result.message || "Katalog yuklanmadi"
        }
      }));
    }

    return result;
  },
  syncOrdersFromApi: async ({ isCurrent = () => true } = {}) => {
    const session = clientStoreDependencies.getSession();
    const token = session?.token;
    if (!token) return { ok: false, message: "No API session token" };
    const ticket = clientRequestGuard.begin("orders", session.userId);

    const result = await clientStoreDependencies.fetchOrdersApi(token);
    if (!isCurrent() || !clientRequestGuard.isCurrent(ticket, currentAccountId())) return { ...result, ok: false, stale: true };
    if (result.ok) {
      const active = result.orders.find((order) =>
        [TRACKING_STATUSES.REQUEST_SENT, TRACKING_STATUSES.ACCEPTED, TRACKING_STATUSES.ON_THE_WAY, TRACKING_STATUSES.IN_PROGRESS].includes(
          order.statusKey
        )
      );

      set((state) => ({
        orders: result.orders,
        activeOrder: active || null,
        apiStatus: {
          ...state.apiStatus,
          ordersSource: "api",
          lastError: null
        }
      }));
    }

    return result;
  },
  syncBannersFromApi: async () => {
    const result = await fetchBannersApi();

    if (result.ok) {
      set({
        banners: result.banners
      });
    }

    return result;
  },
  syncClientProfileFromApi: async () => {
    const session = clientStoreDependencies.getSession();
    const token = session?.token;
    if (!token) return { ok: false, message: "No API session token" };

    const addressTicket = clientRequestGuard.begin("addresses", session.userId);
    const favoritesTicket = clientRequestGuard.begin("favorites", session.userId);

    const [addressesResult, favoritesResult] = await Promise.all([
      clientStoreDependencies.getAddressesApi(token),
      clientStoreDependencies.fetchFavoritesApi(token)
    ]);
    const addressResponseIsCurrent = clientRequestGuard.isCurrent(addressTicket, currentAccountId());
    const favoritesResponseIsCurrent = clientRequestGuard.isCurrent(favoritesTicket, currentAccountId());

    set((state) => ({
      ...(addressResponseIsCurrent
        ? {
            ...(addressesResult.ok ? reconcileCatalogAddressState(state, addressesResult.addresses) : {}),
            addressStatus: {
              ...state.addressStatus,
              loading: false,
              error: addressesResult.ok ? null : addressesResult.message || "Manzillar yuklanmadi"
            }
          }
        : {}),
      ...(favoritesResponseIsCurrent && favoritesResult.ok
        ? { favoriteWorkerIds: favoritesResult.favoriteWorkerIds }
        : {})
    }));

    if (!addressResponseIsCurrent && !favoritesResponseIsCurrent) return { ok: false, stale: true };
    return { ok: addressesResult.ok || favoritesResult.ok };
  },
  loadAddresses: async () => {
    const session = clientStoreDependencies.getSession();
    const token = session?.token;
    if (!token) return { ok: false, message: "Manzillarni yuklash uchun tizimga kiring." };
    const requestTicket = clientRequestGuard.begin("addresses", session.userId);

    set((state) => ({
      addressStatus: {
        ...state.addressStatus,
        loading: true,
        error: null
      }
    }));

    const result = await clientStoreDependencies.getAddressesApi(token);

    if (clientRequestGuard.isCurrent(requestTicket, currentAccountId())) {
      set((state) => ({
        ...(result.ok ? reconcileCatalogAddressState(state, result.addresses) : {}),
        addressStatus: {
          ...state.addressStatus,
          loading: false,
          error: result.ok ? null : result.message || "Manzillar yuklanmadi"
        }
      }));
    } else return { ...result, ok: false, stale: true };

    return result;
  },
  setCatalogQuery: (query) => set({ catalogQuery: query }),
  updateCatalogFilters: (patch) =>
    set((state) => ({
      catalogFilters: {
        ...state.catalogFilters,
        ...patch
      }
    })),
  resetCatalogFilters: () => set({ catalogFilters: DEFAULT_CATALOG_FILTERS }),
  toggleFavoriteWorker: async (workerId) => {
    const session = clientStoreDependencies.getSession();
    const token = session?.token;
    const isFavorite = get().favoriteWorkerIds.includes(workerId);

    if (!token || !session?.userId) return { ok: false, code: "UNAUTHORIZED", message: "Login required" };
    const ticket = clientRequestGuard.begin(`favorite:${workerId}`, session.userId);
    const result = isFavorite
      ? await clientStoreDependencies.removeFavoriteApi(token, workerId)
      : await clientStoreDependencies.addFavoriteApi(token, workerId);

    if (!clientRequestGuard.isCurrent(ticket, currentAccountId())) return { ...result, ok: false, stale: true };
    if (!result.ok) return result;

    set((state) => ({
      favoriteWorkerIds: isFavorite
        ? state.favoriteWorkerIds.filter((id) => id !== workerId)
        : state.favoriteWorkerIds.includes(workerId)
          ? state.favoriteWorkerIds
          : [...state.favoriteWorkerIds, workerId]
    }));
    return result;
  },
  createAddress: async (address) => {
    const session = clientStoreDependencies.getSession();
    const token = session?.token;
    const tempId = `address-${Date.now()}`;
    const optimisticAddress = {
      id: tempId,
      isOptimistic: true,
      title: address.title || address.label,
      label: address.title || address.label,
      address: address.address || address.addressText,
      addressText: address.address || address.addressText,
      lat: address.lat ?? address.latitude ?? null,
      lng: address.lng ?? address.longitude ?? null,
      latitude: address.lat ?? address.latitude ?? null,
      longitude: address.lng ?? address.longitude ?? null,
      district: address.district,
      cityId: address.cityId,
      isDefault: Boolean(address.isDefault)
    };

    if (!token) return { ok: false, message: "Manzil qo'shish uchun tizimga kiring." };
    const requestTicket = clientRequestGuard.begin(`address-create:${tempId}`, session.userId);

    set((state) => ({
      savedAddresses: [
        ...state.savedAddresses.map((item) => (optimisticAddress.isDefault ? { ...item, isDefault: false } : item)),
        optimisticAddress
      ],
      addressStatus: {
        ...state.addressStatus,
        saving: true,
        error: null
      }
    }));

    const result = await clientStoreDependencies.createAddressApi(token, address);
    if (!clientRequestGuard.isCurrent(requestTicket, currentAccountId())) {
      return { ...result, ok: false, stale: true };
    }

    if (result.ok) {
      set((state) => ({
        ...reconcileCatalogAddressState(
          state,
          replaceOptimisticAddress(state.savedAddresses, tempId, result.address)
        ),
        addressStatus: {
          ...state.addressStatus,
          saving: false,
          error: null
        }
      }));
      return result;
    }

    set((state) => ({
      ...reconcileCatalogAddressState(
        state,
        state.savedAddresses.filter((item) => item.id !== tempId)
      ),
      addressStatus: {
        ...state.addressStatus,
        saving: false,
        error: result.message || "Manzil qo'shilmadi"
      }
    }));

    return result;
  },
  updateAddress: async (addressId, patch) => {
    const session = clientStoreDependencies.getSession();
    const token = session?.token;
    if (!token) return { ok: false, message: "Manzilni yangilash uchun tizimga kiring." };
    const requestTicket = clientRequestGuard.begin(`address-update:${addressId}`, session.userId);

    const previousAddresses = get().savedAddresses;
    const optimisticPatch = {
      ...(patch.title || patch.label ? { title: patch.title || patch.label, label: patch.title || patch.label } : {}),
      ...(patch.address || patch.addressText ? { address: patch.address || patch.addressText, addressText: patch.address || patch.addressText } : {}),
      ...(patch.lat !== undefined || patch.latitude !== undefined ? { lat: patch.lat ?? patch.latitude, latitude: patch.lat ?? patch.latitude } : {}),
      ...(patch.lng !== undefined || patch.longitude !== undefined ? { lng: patch.lng ?? patch.longitude, longitude: patch.lng ?? patch.longitude } : {}),
      ...(patch.district !== undefined ? { district: patch.district } : {}),
      ...(patch.cityId !== undefined ? { cityId: patch.cityId } : {}),
      ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {})
    };

    set((state) => ({
      savedAddresses: state.savedAddresses.map((address) => {
        if (patch.isDefault && address.id !== addressId) return { ...address, isDefault: false };
        if (address.id === addressId) return { ...address, ...optimisticPatch };
        return address;
      }),
      addressStatus: {
        ...state.addressStatus,
        saving: true,
        error: null
      }
    }));

    const result = await clientStoreDependencies.updateAddressApi(token, addressId, patch);
    if (!clientRequestGuard.isCurrent(requestTicket, currentAccountId())) {
      return { ...result, ok: false, stale: true };
    }

    if (result.ok) {
      set((state) => ({
        ...reconcileCatalogAddressState(
          state,
          replaceUpdatedAddress(state.savedAddresses, addressId, result.address)
        ),
        addressStatus: {
          ...state.addressStatus,
          saving: false,
          error: null
        }
      }));
      return result;
    }

    set((state) => ({
      ...reconcileCatalogAddressState(state, previousAddresses),
      addressStatus: {
        ...state.addressStatus,
        saving: false,
        error: result.message || "Manzil yangilanmadi"
      }
    }));

    return result;
  },
  removeAddress: async (addressId) => {
    const session = clientStoreDependencies.getSession();
    const token = session?.token;
    if (!token) return { ok: false, message: "Manzilni o'chirish uchun tizimga kiring." };
    const requestTicket = clientRequestGuard.begin(`address-delete:${addressId}`, session.userId);

    const previousAddresses = get().savedAddresses;

    set((state) => ({
      ...reconcileCatalogAddressState(
        state,
        state.savedAddresses.filter((address) => address.id !== addressId)
      ),
      addressStatus: {
        ...state.addressStatus,
        saving: true,
        error: null
      }
    }));

    const result = await clientStoreDependencies.deleteAddressApi(token, addressId);
    if (!clientRequestGuard.isCurrent(requestTicket, currentAccountId())) {
      return { ...result, ok: false, stale: true };
    }

    if (result.ok) {
      set((state) => ({
        ...reconcileCatalogAddressState(state, state.savedAddresses),
        addressStatus: {
          ...state.addressStatus,
          saving: false,
          error: null
        }
      }));
      return result;
    }

    set((state) => ({
      ...reconcileCatalogAddressState(state, previousAddresses),
      addressStatus: {
        ...state.addressStatus,
        saving: false,
        error: result.message || "Manzil o'chirilmadi"
      }
    }));

    return result;
  },
  addSavedAddress: async (address) => {
    return get().createAddress(address);
  },
  removeSavedAddress: async (addressId) => {
    return get().removeAddress(addressId);
  },
  selectWorker: (workerId) => set({ selectedWorkerId: workerId }),
  upsertPublicWorker: (worker) =>
    set((state) => ({
      workers: worker
        ? [worker, ...state.workers.filter((item) => item.id !== worker.id)]
        : state.workers,
      selectedWorkerId: worker?.id || state.selectedWorkerId
    })),
  getSelectedWorker: () => {
    const { selectedWorkerId, workers: workerList } = get();
    return workerList.find((worker) => worker.id === selectedWorkerId) || workerList[0] || null;
  },
  resetOrderDraft: (patch = {}) =>
    set({
      orderDraft: {
        ...initialOrderDraft,
        ...patch
      }
    }),
  updateOrderDraft: (patch) =>
    set((state) => ({
      orderDraft: {
        ...state.orderDraft,
        ...patch
      }
    })),
  setOrderStatus: (status) =>
    set((state) => ({
      orderDraft: {
        ...state.orderDraft,
        status
      }
    })),
  sendMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, ["out", message]]
    })),
  createOrderFromDraft: async () => {
    const state = get();
    const service = state.categories.find((item) => item.id === state.orderDraft.serviceId);
    const worker = state.workers.find((item) => item.id === state.orderDraft.selectedWorkerId) || state.getSelectedWorker();
    const session = clientStoreDependencies.getSession();
    const token = session?.token;

    if (!token) {
      return { ok: false, message: "Buyurtma berish uchun tizimga kiring." };
    }

    if (token && worker?.id) {
      const ticket = clientRequestGuard.begin("order-create", session.userId);
      const result = await clientStoreDependencies.createOrderApi(token, state.orderDraft, service, worker);
      if (!clientRequestGuard.isCurrent(ticket, currentAccountId())) return { ...result, ok: false, stale: true };

      if (result.ok) {
        set((current) => ({
          activeOrder: result.order,
          orders: [result.order, ...current.orders.filter((order) => order.id !== result.order.id)],
          selectedWorkerId: worker.id,
          orderDraft: {
            ...current.orderDraft,
            selectedWorkerId: worker.id,
            status: ORDER_STATES.IN_PROGRESS
          },
          apiStatus: {
            ...current.apiStatus,
            ordersSource: "api",
            lastError: null
          }
        }));
        return result;
      }

      if (result.code === "WORKER_NOT_AVAILABLE") {
        await get().syncCatalogFromApi(service?.id);
        return {
          ...result,
          message: "Usta hozir boshqa buyurtma bilan band. Katalog yangilandi, boshqa mavjud ustani tanlang."
        };
      }

      return result;
    }

    return { ok: false, message: "Usta tanlanmagan." };
  },
  cancelActiveOrder: async (reason) => {
    const state = get();
    const session = clientStoreDependencies.getSession();
    const token = session?.token;

    if (!token || !state.activeOrder?.id) return { ok: false, message: "Faol buyurtma topilmadi." };

    const ticket = clientRequestGuard.begin("order-cancel", session.userId);
    clientRequestGuard.begin("orders", session.userId);
    const result = await clientStoreDependencies.cancelOrderApi(token, state.activeOrder.id, reason);
    if (!clientRequestGuard.isCurrent(ticket, currentAccountId())) return { ...result, ok: false, stale: true };
    clientRequestGuard.begin("orders", session.userId);
    if (result.ok) {
      set((current) => ({
        activeOrder: result.order,
        orders: [result.order, ...current.orders.filter((order) => order.id !== result.order.id)]
      }));
    }

    return result;
  }
}));

registerSessionResetHandler(() => useClientStore.getState().clearUserData());
