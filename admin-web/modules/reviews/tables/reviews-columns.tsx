"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminReview } from "../types/review";

export const reviewsColumns: ColumnDef<AdminReview>[] = [
  { accessorKey: "worker", header: "Usta" },
  { accessorKey: "client", header: "Mijoz" },
  { accessorKey: "rating", header: "Reyting" },
  {
    accessorKey: "text",
    header: "Sharh",
    cell: ({ row }) => <span className="line-clamp-2 max-w-md">{row.original.text}</span>
  },
  { accessorKey: "date", header: "Sana" },
  {
    accessorKey: "status",
    header: "Holat",
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  }
];
