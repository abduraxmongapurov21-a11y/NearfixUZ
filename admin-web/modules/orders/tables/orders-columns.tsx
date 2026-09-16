"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminOrder } from "../types/order";

const formatAmount = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

export const ordersColumns: ColumnDef<AdminOrder>[] = [
  { accessorKey: "id", header: "Buyurtma raqami" },
  { accessorKey: "client", header: "Mijoz" },
  { accessorKey: "worker", header: "Usta" },
  { accessorKey: "city", header: "Shahar" },
  { accessorKey: "service", header: "Xizmat" },
  {
    accessorKey: "status",
    header: "Holat",
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  },
  { accessorKey: "createdAt", header: "Yaratilgan vaqti" },
  {
    accessorKey: "amount",
    header: "Summa",
    cell: ({ row }) => formatAmount(row.original.amount)
  }
];
