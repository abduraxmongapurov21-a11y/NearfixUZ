import { create } from "zustand";
import { TRACKING_STATUSES } from "../constants/orderTracking";
import { WORKER_STATUS } from "../constants/workerStatus";
import {
  acceptOrderApi,
  fetchIncomingOrdersApi,
  fetchWorkerEarningsApi,
  fetchWorkerMeApi,
  fetchWorkerOrdersApi,
  fetchWorkerTransactionsApi,
  rejectOrderApi,
  updateAvailabilityApi,
  updateWorkerProfileApi,
  updateWorkerServiceLocationApi,
  updateOrderStatusApi
} from "../services/workers/workerService";
import { useAuthStore } from "./authStore";
import { registerSessionResetHandler } from "./sessionReset";
import { createAccountRequestGuard } from "./requestGeneration.mjs";
import { buildWorkerProfileSyncStatus } from "./workerSyncState.mjs";

const workerRequestGuard = createAccountRequestGuard();

const defaultWorkerStoreDependencies = {
  getSession: () => useAuthStore.getState().session,
  fetchWorkerMeApi,
  fetchIncomingOrdersApi,
  fetchWorkerOrdersApi,
  fetchWorkerEarningsApi,
  fetchWorkerTransactionsApi,
  updateWorkerServiceLocationApi
};
const workerStoreDependencies = { ...defaultWorkerStoreDependencies };

export function configureWorkerStoreForTests(overrides = {}) {
  Object.assign(workerStoreDependencies, overrides);
  return () => Object.assign(workerStoreDependencies, defaultWorkerStoreDependencies);
}

function currentAccountId() {
  return workerStoreDependencies.getSession()?.userId || null;
}

const activeWorkerStatuses = [
  TRACKING_STATUSES.ACCEPTED,
  TRACKING_STATUSES.ON_THE_WAY,
  TRACKING_STATUSES.IN_PROGRESS
];

function resolveOrderStatusKey(order) {
  return order?.statusKey || order?.status;
}

function isActiveWorkerOrder(order) {
  return activeWorkerStatuses.includes(resolveOrderStatusKey(order));
}

function workerOrderErrorMessage(result, fallback) {
  switch (result?.code) {
    case "ORDER_RESPONSE_EXPIRED":
      return "Buyurtmani qabul qilish muddati tugagan. Ro'yxat yangilanmoqda.";
    case "ORDER_ALREADY_ACCEPTED":
    case "ORDER_STATUS_CONFLICT":
      return "Bu buyurtma holati allaqachon o'zgargan. Ro'yxat yangilanmoqda.";
    case "ORDER_NOT_FOUND":
      return "Buyurtma topilmadi. Ro'yxat yangilanmoqda.";
    case "ORDER_NOT_ASSIGNED":
      return "Bu buyurtma sizga biriktirilmagan.";
    case "WORKER_NOT_AVAILABLE":
      return "Siz hozir yangi buyurtma qabul qila olmaysiz. Statusingizni tekshiring.";
    case "PROVIDER_OR_ADMIN_REQUIRED":
    case "PROVIDER_REQUIRED":
    case "FORBIDDEN":
      return "Buyurtmani qabul qilish uchun usta akkaunti bilan kiring.";
    case "ACCESS_TOKEN_EXPIRED":
    case "SESSION_INVALID":
      return "Sessiya muddati tugagan. Qayta tizimga kiring.";
    default:
      return result?.message || fallback;
  }
}

function shouldRemoveIncomingRequest(result) {
  return ["ORDER_RESPONSE_EXPIRED", "ORDER_ALREADY_ACCEPTED", "ORDER_STATUS_CONFLICT", "ORDER_NOT_FOUND"].includes(result?.code);
}

export const useWorkerStore = create((set, get) => ({
  workerProfile: null,
  incomingRequests: [],
  activeJob: null,
  operationalStatus: WORKER_STATUS.OFFLINE,
  earnings: {
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    completedJobs: 0,
    activeHours: 0,
    averagePerDay: 0,
    growthPercentage: 0,
    platformFees: 0,
    revenueTrend: []
  },
  transactions: [],
  completedOrders: [],
  apiStatus: {
    source: "idle",
    lastError: null
  },
  profileSyncStatus: {
    loading: false,
    error: null,
    isStale: false,
    lastSyncedAt: null
  },
  serviceLocationStatus: {
    saving: false,
    error: null
  },
  clearUserData: () => {
    workerRequestGuard.invalidateSession();
    set({
      workerProfile: null,
      incomingRequests: [],
      activeJob: null,
      operationalStatus: WORKER_STATUS.OFFLINE,
      earnings: {
        todayEarnings: 0,
        weekEarnings: 0,
        monthEarnings: 0,
        completedJobs: 0,
        activeHours: 0,
        averagePerDay: 0,
        growthPercentage: 0,
        platformFees: 0,
        revenueTrend: []
      },
      transactions: [],
      completedOrders: [],
      apiStatus: {
        source: "idle",
        lastError: null
      },
      profileSyncStatus: {
        loading: false,
        error: null,
        isStale: false,
        lastSyncedAt: null
      },
      serviceLocationStatus: {
        saving: false,
        error: null
      }
    });
  },
  syncWorkerFromApi: async () => {
    const session = workerStoreDependencies.getSession();
    const token = session?.token;
    if (!token) return { ok: false, message: "API sessiya tokeni topilmadi." };
    const requestTicket = workerRequestGuard.begin("worker-sync", session.userId);

    set((state) => ({
      profileSyncStatus: { ...state.profileSyncStatus, loading: true, error: null }
    }));

    const [profileResult, incomingResult, ordersResult, earningsResult, transactionsResult] = await Promise.all([
      workerStoreDependencies.fetchWorkerMeApi(token),
      workerStoreDependencies.fetchIncomingOrdersApi(token),
      workerStoreDependencies.fetchWorkerOrdersApi(token),
      workerStoreDependencies.fetchWorkerEarningsApi(token),
      workerStoreDependencies.fetchWorkerTransactionsApi(token)
    ]);

    if (!workerRequestGuard.isCurrent(requestTicket, currentAccountId())) {
      return { ok: false, stale: true };
    }

    set((state) => {
      const activeJob = ordersResult.ok
        ? ordersResult.orders.find(isActiveWorkerOrder) || null
        : state.activeJob;

      return {
        workerProfile: profileResult.ok && profileResult.worker ? { ...(state.workerProfile || {}), ...profileResult.worker } : state.workerProfile,
        operationalStatus: profileResult.ok && profileResult.worker?.availability ? profileResult.worker.availability : state.operationalStatus,
        incomingRequests: incomingResult.ok ? incomingResult.requests : state.incomingRequests,
        activeJob,
        earnings: earningsResult.ok && earningsResult.earnings ? earningsResult.earnings : state.earnings,
        transactions: transactionsResult.ok ? transactionsResult.transactions : state.transactions,
        completedOrders: ordersResult.ok
          ? ordersResult.orders.filter((order) => order.statusKey === TRACKING_STATUSES.COMPLETED)
          : state.completedOrders,
        apiStatus: {
          source: profileResult.ok || incomingResult.ok || ordersResult.ok || earningsResult.ok || transactionsResult.ok ? "api" : state.apiStatus.source,
          lastError: null
        },
        profileSyncStatus: buildWorkerProfileSyncStatus(profileResult, state.profileSyncStatus)
      };
    });

    return { ok: profileResult.ok || incomingResult.ok || ordersResult.ok };
  },
  setOperationalStatus: async (status) => {
    const token = useAuthStore.getState().session?.token;

    if (token) {
      const result = await updateAvailabilityApi(token, status);
      if (result.ok) {
        set((state) => ({
          operationalStatus: result.availability.status,
          workerProfile: {
            ...state.workerProfile,
            availability: result.availability.status
          },
          apiStatus: {
            source: "api",
            lastError: null
          }
        }));
        return result;
      }
    }

    return { ok: false, message: "Holatni o'zgartirish uchun tizimga kiring." };
  },
  submitWorkerProfile: async (profile) => {
    const token = useAuthStore.getState().session?.token;

    if (!token) return { ok: false, code: "UNAUTHORIZED", message: "Profilni saqlash uchun tizimga kiring." };

    const result = await updateWorkerProfileApi(token, profile);
    if (!result.ok) {
      set((state) => ({
        apiStatus: {
          ...state.apiStatus,
          lastError: result.message || "Profilni yuborishda xatolik yuz berdi."
        }
      }));
      return result;
    }

    set((state) => ({
      workerProfile: {
        ...state.workerProfile,
        ...result.worker
      },
      apiStatus: {
        source: "api",
        lastError: null
      }
    }));
    return result;
  },
  saveServiceLocation: async (locationPayload) => {
    const session = workerStoreDependencies.getSession();
    const token = session?.token;
    if (!token) return { ok: false, code: "UNAUTHORIZED", message: "Profilni saqlash uchun tizimga kiring." };
    const requestTicket = workerRequestGuard.begin("worker-location", session.userId);

    set({ serviceLocationStatus: { saving: true, error: null } });
    const result = await workerStoreDependencies.updateWorkerServiceLocationApi(token, locationPayload);
    if (!workerRequestGuard.isCurrent(requestTicket, currentAccountId())) {
      return { ...result, ok: false, stale: true };
    }
    if (!result.ok) {
      set({
        serviceLocationStatus: {
          saving: false,
          error: result.message || "Lokatsiyani saqlab bo'lmadi."
        }
      });
      return result;
    }

    set((state) => ({
      workerProfile: {
        ...state.workerProfile,
        ...result.worker
      },
      serviceLocationStatus: {
        saving: false,
        error: null
      }
    }));
    return result;
  },
  acceptIncomingRequest: async (requestId) => {
    const token = useAuthStore.getState().session?.token;

    if (!token) {
      return { ok: false, message: "Buyurtmani qabul qilish uchun tizimga kiring." };
    }

    const result = await acceptOrderApi(token, requestId);
    if (result.ok) {
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((item) => item.id !== requestId),
        operationalStatus: WORKER_STATUS.BUSY,
        workerProfile: {
          ...state.workerProfile,
          availability: WORKER_STATUS.BUSY
        },
        activeJob: {
          ...result.order,
          problemTitle: result.order.title,
          service: result.order.service,
          clientName: result.order.clientName || "Mijoz",
          address: result.order.address,
          estimatedPayment: result.order.amount
        },
        apiStatus: {
          source: "api",
          lastError: null
        }
      }));
      return result;
    }

    if (shouldRemoveIncomingRequest(result)) {
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((item) => item.id !== requestId)
      }));
    }

    return {
      ...result,
      message: workerOrderErrorMessage(result, "Buyurtmani qabul qilib bo'lmadi. Qayta urinib ko'ring.")
    };
  },
  rejectIncomingRequest: async (requestId, reason) => {
    const token = useAuthStore.getState().session?.token;

    if (!token) {
      return { ok: false, message: "Buyurtmani bekor qilish uchun tizimga kiring." };
    }

    const result = await rejectOrderApi(token, requestId, reason);
    if (result.ok) {
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((item) => item.id !== requestId)
      }));
      return result;
    }

    if (shouldRemoveIncomingRequest(result)) {
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((item) => item.id !== requestId)
      }));
    }

    return {
      ...result,
      message: workerOrderErrorMessage(result, "Buyurtmani bekor qilib bo'lmadi. Qayta urinib ko'ring.")
    };
  },
  updateActiveJobStatus: async (statusKey) => {
    const token = useAuthStore.getState().session?.token;
    const activeJob = get().activeJob;

    if (token && activeJob?.id) {
      const result = await updateOrderStatusApi(token, activeJob.id, statusKey);
      if (result.ok) {
        set((state) => ({
          activeJob: state.activeJob ? { ...state.activeJob, ...result.order } : result.order
        }));
        return result;
      }
    }

    return { ok: false, message: "Faol ish topilmadi." };
  },
  completeActiveJob: async () => {
    const token = useAuthStore.getState().session?.token;
    const activeJob = get().activeJob;

    if (token && activeJob?.id) {
      const result = await updateOrderStatusApi(token, activeJob.id, TRACKING_STATUSES.COMPLETED);
      if (result.ok) {
        set((state) => ({
          activeJob: null,
          operationalStatus: WORKER_STATUS.AVAILABLE,
          workerProfile: {
            ...state.workerProfile,
            availability: WORKER_STATUS.AVAILABLE,
            completedOrders: (state.workerProfile.completedOrders || 0) + 1
          },
          earnings: {
            ...state.earnings,
            completedJobs: state.earnings.completedJobs + 1
          },
          completedOrders: [result.order, ...state.completedOrders]
        }));
        return result;
      }
    }

    return { ok: false, message: "Faol ish topilmadi." };
  }
}));

registerSessionResetHandler(() => useWorkerStore.getState().clearUserData());
