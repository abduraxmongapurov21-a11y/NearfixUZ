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
    onError: (value) => setActionError(value instanceof Error ? value.message : "Review action failed"),
    onSuccess: async () => {
      setActionError("");
      await queryClient.invalidateQueries({ queryKey: ["reviews"] });
    }
  });
  const columns = useMemo<ColumnDef<AdminReview>[]>(
    () => [
      { accessorKey: "worker", header: "Worker" },
      { accessorKey: "client", header: "Client" },
      { accessorKey: "rating", header: "Rating" },
      { accessorKey: "text", header: "Review", cell: ({ row }) => <span className="line-clamp-2 max-w-md">{row.original.text}</span> },
      { accessorKey: "date", header: "Date" },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "actions",
        header: "Moderation",
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
            {row.original.status === "hidden" ? "Restore" : "Hide"}
          </Button>
        )
      }
    ],
    [mutation]
  );

  return (
    <div>
      <FilterBar filters={["Rating", "Status", "Date"]} searchPlaceholder="Worker yoki client qidirish" />
      {error ? <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error.message}</div> : null}
      {actionError ? <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{actionError}</div> : null}
      <DataTable columns={columns} data={data} />
    </div>
  );
}
