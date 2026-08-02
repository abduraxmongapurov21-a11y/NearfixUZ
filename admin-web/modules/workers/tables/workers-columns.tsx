"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminWorker } from "../types/worker";

const formatAmount = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

export const workersColumns: ColumnDef<AdminWorker>[] = [
  {
    accessorKey: "name",
    header: "Worker",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">{row.original.profession}</div>
      </div>
    )
  },
  {
    accessorKey: "status",
    header: "Review",
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  },
  { accessorKey: "city", header: "City" },
  {
    accessorKey: "availability",
    header: "Availability",
    cell: ({ row }) => <StatusBadge status={row.original.availability} />
  },
  { accessorKey: "completedJobs", header: "Completed" },
  { accessorKey: "ignoredRequests", header: "Ignored" },
  { accessorKey: "rating", header: "Rating" },
  { accessorKey: "responseSpeed", header: "Response" },
  {
    accessorKey: "totalEarnings",
    header: "Earnings",
    cell: ({ row }) => formatAmount(row.original.totalEarnings)
  }
];
