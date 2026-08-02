import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminWorker, City, WorkerAvailability, WorkerProfileStatus } from "@/contracts/admin";

function mapAvailability(status: string): WorkerAvailability {
  const value = status.toLowerCase();
  if (value === "available" || value === "busy" || value === "offline") return value;
  return "offline";
}

function mapWorkerStatus(status: string): WorkerProfileStatus {
  const value = status.toLowerCase();
  if (value === "draft" || value === "approved" || value === "suspended") return value;
  return "draft";
}

export async function getWorkers(): Promise<AdminWorker[]> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin authentication required");

  const payload = await apiClient<{ ok: boolean; workers: any[] }>("/admin/workers", { token });
  return payload.workers.map((worker) => ({
    id: worker.id,
    name: worker.user?.name || "Kiritilmagan",
    phone: worker.user?.phone || "",
    profession: worker.profession || "",
    professions: Array.isArray(worker.professions) && worker.professions.length
      ? worker.professions
      : worker.profession
        ? [worker.profession]
        : [],
    status: mapWorkerStatus(String(worker.status || "draft")),
    city: (worker.user?.cityId || "Kiritilmagan") as City,
    availability: mapAvailability(String(worker.availability?.status || "offline")),
    experienceYears: worker.experienceYears || 0,
    profileImageUrl: worker.profileImageUrl || undefined,
    bio: worker.bio || undefined,
    submittedAt: worker.submittedAt ? new Date(worker.submittedAt).toLocaleString("uz-UZ") : undefined,
    moderationReason: worker.moderationReason || undefined,
    basePrice: worker.basePrice || 0,
    completedJobs: worker.completedOrdersCount || 0,
    ignoredRequests: 0,
    rating: Number(worker.ratingAvg || 0),
    totalEarnings: 0,
    responseSpeed: "1 hour"
  }));
}

export async function approveWorker(worker: AdminWorker): Promise<AdminWorker> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");

  const payload = await apiClient<{ ok: boolean; worker: any }>(`/admin/workers/${worker.id}/approve`, {
    method: "POST",
    token,
    body: JSON.stringify({
      profession: worker.professions[0] || worker.profession,
      professions: worker.professions.length ? worker.professions : [worker.profession],
      cityId: worker.city === "Kiritilmagan" ? undefined : worker.city,
      experienceYears: worker.experienceYears,
      profileImageUrl: worker.profileImageUrl,
      bio: worker.bio,
      basePrice: worker.basePrice || undefined
    })
  });

  const approved = payload.worker;
  return {
    ...worker,
    status: mapWorkerStatus(String(approved.status || "approved")),
    availability: mapAvailability(String(approved.availability?.status || worker.availability)),
    moderationReason: approved.moderationReason || undefined
  };
}

async function moderateWorker(
  worker: AdminWorker,
  action: "reject" | "suspend" | "unsuspend",
  reason: string
): Promise<AdminWorker> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin token is missing");

  const payload = await apiClient<{ ok: boolean; worker: any }>(`/admin/workers/${worker.id}/${action}`, {
    method: "POST",
    token,
    body: JSON.stringify({ reason })
  });

  const updated = payload.worker;
  return {
    ...worker,
    status: mapWorkerStatus(String(updated.status || worker.status)),
    availability: mapAvailability(String(updated.availability?.status || worker.availability)),
    submittedAt: updated.submittedAt ? new Date(updated.submittedAt).toLocaleString("uz-UZ") : undefined,
    moderationReason: updated.moderationReason || undefined
  };
}

export async function rejectWorker(worker: AdminWorker, reason = "Rejected by admin") {
  return moderateWorker(worker, "reject", reason);
}

export async function suspendWorker(worker: AdminWorker, reason = "Suspended by admin") {
  return moderateWorker(worker, "suspend", reason);
}

export async function unsuspendWorker(worker: AdminWorker, reason = "Unsuspended by admin") {
  return moderateWorker(worker, "unsuspend", reason);
}
