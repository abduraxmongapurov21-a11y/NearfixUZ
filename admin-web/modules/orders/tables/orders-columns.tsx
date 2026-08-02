"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminOrder } from "../types/order";

const formatAmount = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

export const ordersColumns: ColumnDef<AdminOrder>[] = [
  { accessorKey: "id", header: "Order ID" },
  { accessorKey: "client", header: "Client" },
  { accessorKey: "worker", header: "Worker" },
  { accessorKey: "city", header: "City" },
  { accessorKey: "service", header: "Service" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  },
  { accessorKey: "createdAt", header: "Created" },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatAmount(row.original.amount)
  }
];
