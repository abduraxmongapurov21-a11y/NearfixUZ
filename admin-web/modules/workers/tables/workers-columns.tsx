"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/shared/components/status-badge";
import { adminLabel } from "@/lib/admin-labels";
import type { AdminWorker } from "../types/worker";

const formatAmount = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

export const workersColumns: ColumnDef<AdminWorker>[] = [
  {
    accessorKey: "name",
    header: "Usta",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">{row.original.profession}</div>
      </div>
    )
  },
  {
    accessorKey: "status",
    header: "Tasdiq holati",
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  },
  {
    accessorKey: "city",
    header: "Shahar",
    cell: ({ row }) => adminLabel(row.original.city)
  },
  {
    accessorKey: "availability",
    header: "Bandlik holati",
    cell: ({ row }) => <StatusBadge status={row.original.availability} />
  },
  { accessorKey: "completedJobs", header: "Bajarilgan" },
  { accessorKey: "ignoredRequests", header: "E'tiborsiz qolgan" },
  { accessorKey: "rating", header: "Reyting" },
  { accessorKey: "responseSpeed", header: "Javob tezligi" },
  {
    accessorKey: "totalEarnings",
    header: "Daromad",
    cell: ({ row }) => formatAmount(row.original.totalEarnings)
  }
];
