"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminReview } from "../types/review";

export const reviewsColumns: ColumnDef<AdminReview>[] = [
  { accessorKey: "worker", header: "Worker" },
  { accessorKey: "client", header: "Client" },
  { accessorKey: "rating", header: "Rating" },
  {
    accessorKey: "text",
    header: "Review",
    cell: ({ row }) => <span className="line-clamp-2 max-w-md">{row.original.text}</span>
  },
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  }
];
