"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/shared/components/data-table";
import { FilterBar } from "@/shared/components/filter-bar";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminReview } from "../types/review";
import { useReviews } from "../hooks/use-reviews";
import { setReviewModerationStatus } from "../services/reviews-service";

export function ReviewsTable() {
  const { data = [], error } = useReviews();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: string; status: "published" | "hidden" }) =>
      setReviewModerationStatus(reviewId, status),
    onError: (value) => setActionError(value instanceof Error ? value.message : "Sharh bo'yicha amal bajarilmadi"),
    onSuccess: async () => {
      setActionError("");
      await queryClient.invalidateQueries({ queryKey: ["reviews"] });
    }
  });
  const columns = useMemo<ColumnDef<AdminReview>[]>(
    () => [
      { accessorKey: "worker", header: "Usta" },
      { accessorKey: "client", header: "Mijoz" },
      { accessorKey: "rating", header: "Reyting" },
      { accessorKey: "text", header: "Sharh", cell: ({ row }) => <span className="line-clamp-2 max-w-md">{row.original.text}</span> },
      { accessorKey: "date", header: "Sana" },
      { accessorKey: "status", header: "Holat", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "actions",
        header: "Moderatsiya",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                reviewId: row.original.id,
                status: row.original.status === "hidden" ? "published" : "hidden"
              })
            }
          >
            {row.original.status === "hidden" ? "Qayta ko'rsatish" : "Yashirish"}
          </Button>
        )
      }
    ],
    [mutation]
  );

  return (
    <div>
      <FilterBar filters={["Reyting", "Holat", "Sana"]} searchPlaceholder="Usta yoki mijozni qidirish" />
      {error ? <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error.message}</div> : null}
      {actionError ? <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{actionError}</div> : null}
      <DataTable columns={columns} data={data} />
    </div>
  );
}
