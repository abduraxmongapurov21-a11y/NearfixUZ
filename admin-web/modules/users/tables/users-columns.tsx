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
    header: "User",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">{row.original.phone}</div>
      </div>
    )
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => <StatusBadge status={row.original.role} />
  },
  { accessorKey: "city", header: "City" },
  { accessorKey: "registeredAt", header: "Registered" },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) =>
      row.original.role === "client" ? (
        <Button onClick={() => promoteUser(row.original.id)} size="sm" variant="outline">
          Promote to worker
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Worker profile active</span>
      )
  }
];
