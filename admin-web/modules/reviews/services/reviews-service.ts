import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminReview, ReviewStatus } from "@/contracts/admin";

function mapStatus(status: string): ReviewStatus {
  return status.toLowerCase() === "hidden" ? "hidden" : "published";
}

export async function getReviews(): Promise<AdminReview[]> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin authentication required");

  const payload = await apiClient<{ ok: boolean; reviews: any[] }>("/admin/reviews", { token });
  return payload.reviews.map((review) => ({
    id: review.id,
    worker: review.worker?.user?.name || "Worker",
    client: review.client?.name || "Client",
    rating: review.rating,
    text: review.text || "",
    date: new Date(review.createdAt).toLocaleDateString("uz-UZ"),
    status: mapStatus(String(review.status || "published"))
  }));
}

export async function setReviewModerationStatus(reviewId: string, status: ReviewStatus) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin authentication required");
  const action = status === "hidden" ? "hide" : "restore";
  await apiClient(`/admin/reviews/${reviewId}/${action}`, {
    method: "PATCH",
    token
  });
}
