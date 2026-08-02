import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminUser, City, UserRole } from "@/contracts/admin";

function mapRole(role: string): UserRole {
  const value = role.toLowerCase();
  if (value === "provider" || value === "admin" || value === "super_admin") return value;
  return "client";
}

export async function getUsers(): Promise<AdminUser[]> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin authentication required");

  const payload = await apiClient<{ ok: boolean; users: any[] }>("/admin/users", { token });
  return payload.users.map((user) => ({
    id: user.id,
    name: user.name || user.phone,
    phone: user.phone,
    role: mapRole(String(user.role || "client")),
    city: (user.cityId || "Tashkent") as City,
    registeredAt: new Date(user.createdAt).toLocaleDateString("uz-UZ")
  }));
}
