export type City = string;

export type OrderStatus =
  | "waiting"
  | "active"
  | "completed"
  | "cancelled";

export type WorkerAvailability = "available" | "busy" | "offline";
export type WorkerProfileStatus = "draft" | "approved" | "suspended";

export type UserRole = "client" | "provider" | "admin" | "super_admin";

export type ReviewStatus = "published" | "hidden";

export type DashboardSummary = {
  activeOrders: number;
  waitingResponse: number;
  busyWorkers: number;
  completedToday: number;
  cancelledToday: number;
  cityOverview: {
    city: City;
    activeOrders: number;
    availableWorkers: number;
  }[];
};

export type AdminOrder = {
  orderId: string;
  id: string;
  client: string;
  worker: string;
  city: City;
  service: string;
  status: OrderStatus;
  createdAt: string;
  amount: number;
};

export type AdminOrderDetail = {
  id: string;
  publicCode: string;
  status: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
    phone: string;
  };
  worker: {
    id: string;
    name: string;
    phone: string;
    profession: string;
    availability: string;
  };
  address: {
    label: string;
    cityId: string;
    district?: string;
    addressText: string;
    lat?: string;
    lng?: string;
  } | null;
  city: City;
  service: string;
  problemTitle: string;
  problemDescription?: string;
  priceEstimate: number | null;
  finalAmount: number | null;
  responseDeadline: string | null;
  cancelReason: string | null;
  payments: {
    id: string;
    provider: string;
    status: string;
    amount: number;
    externalId?: string;
    createdAt: string;
    updatedAt: string;
  }[];
  timeline: {
    id: string;
    actorType: string;
    eventType: string;
    fromStatus?: string;
    toStatus?: string;
    message?: string;
    createdAt: string;
  }[];
};

export type AdminWorker = {
  id: string;
  name: string;
  phone: string;
  profession: string;
  professions: string[];
  status: WorkerProfileStatus;
  city: City;
  availability: WorkerAvailability;
  experienceYears: number;
  profileImageUrl?: string;
  bio?: string;
  submittedAt?: string;
  moderationReason?: string;
  basePrice: number;
  completedJobs: number;
  ignoredRequests: number;
  rating: number;
  totalEarnings: number;
  responseSpeed: string;
};

export type AdminUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  city: City;
  registeredAt: string;
};

export type AdminReview = {
  id: string;
  worker: string;
  client: string;
  rating: number;
  text: string;
  date: string;
  status: ReviewStatus;
};
