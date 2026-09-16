"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/shared/components/status-badge";
import { apiClient, getAdminToken } from "@/services/api-client";
import type { AdminUser } from "../types/user";

async function promoteUser(userId: string) {
  const token = getAdminToken();
  if (!token) return;

  await apiClient(`/admin/users/${userId}/promote-provider`, {
    method: "POST",
    token,
    body: JSON.stringify({})
  });
}

export const usersColumns: ColumnDef<AdminUser>[] = [
  {
    accessorKey: "name",
    header: "Foydalanuvchi",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">{row.original.phone}</div>
      </div>
    )
  },
  {
    accessorKey: "role",
    header: "Rol",
    cell: ({ row }) => <StatusBadge status={row.original.role} />
  },
  { accessorKey: "city", header: "Shahar" },
  { accessorKey: "registeredAt", header: "Ro'yxatdan o'tgan" },
  {
    id: "actions",
    header: "Amal",
    cell: ({ row }) =>
      row.original.role === "client" ? (
        <Button onClick={() => promoteUser(row.original.id)} size="sm" variant="outline">
          Usta arizasiga tayyorlash
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Usta huquqi faol</span>
      )
  }
];
