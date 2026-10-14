"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminUser } from "../types/user";

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
  { accessorKey: "registeredAt", header: "Ro'yxatdan o'tgan" }
];
