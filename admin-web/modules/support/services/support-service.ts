import { apiClient, getAdminToken } from "@/services/api-client";

export type AdminSupportTicket = {
  id: string;
  reason: string;
  message?: string | null;
  status: string;
  adminNote?: string | null;
  createdAt: string;
  user: { id: string; name?: string | null; phone: string; role: string; status: string };
  order?: { id: string; publicCode: string; status: string; problemTitle: string } | null;
};

function token() {
  const value = getAdminToken();
  if (!value) throw new Error("Admin authentication required");
  return value;
}

export async function getSupportTickets(filters = "") {
  const payload = await apiClient<{ tickets: AdminSupportTicket[] }>(`/admin/support/tickets${filters}`, { token: token() });
  return payload.tickets;
}

export async function updateSupportTicket(ticketId: string, status: string, adminNote: string) {
  await apiClient(`/admin/support/tickets/${ticketId}`, {
    method: "PATCH",
    token: token(),
    body: JSON.stringify({ status, adminNote })
  });
}
