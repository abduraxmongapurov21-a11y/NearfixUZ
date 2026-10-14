"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/shared/components/data-table";
import { FilterBar, FilterSelect, TableLoadState } from "@/shared/components/filter-bar";
import { getFilterOptions, matchesTableSearch } from "@/shared/utils/table-filters";
import { useAdminUiStore } from "@/stores/ui-store";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { hasPermission } from "@/shared/auth/permissions";
import { adminLabel } from "@/lib/admin-labels";
import { StatusBadge } from "@/shared/components/status-badge";
import type { AdminReview } from "../types/review";
import { useReviews } from "../hooks/use-reviews";
import { setReviewModerationStatus } from "../services/reviews-service";

export function ReviewsTable() {
  const { data = [], error, isPending, refetch } = useReviews();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const globalSearch = useAdminUiStore((state) => state.globalSearch);
  const canManage = useAdminSessionStore((state) => hasPermission(state.session, "reviews.manage"));
  const filteredReviews = data.filter((review) =>
    (!rating || String(review.rating) === rating) && (!status || review.status === status) && (!date || review.date === date) &&
    matchesTableSearch([review.worker, review.client, review.text], [search, globalSearch])
  );
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
            disabled={!canManage || mutation.isPending}
            onClick={() => {
              if (!canManage || mutation.isPending) return;
              mutation.mutate({
                reviewId: row.original.id,
                status: row.original.status === "hidden" ? "published" : "hidden"
              });
            }}
          >
            {row.original.status === "hidden" ? "Qayta ko'rsatish" : "Yashirish"}
          </Button>
        )
      }
    ],
    [mutation, canManage]
  );

  return (
    <div>
      <FilterBar
        controls={<>
          <FilterSelect label="Reyting" onChange={setRating} options={getFilterOptions(["1", "2", "3", "4", "5"])} value={rating} />
          <FilterSelect label="Holat" onChange={setStatus} options={getFilterOptions(["published", "hidden"], adminLabel)} value={status} />
          <FilterSelect label="Sana" onChange={setDate} options={getFilterOptions(data.map((review) => review.date))} value={date} />
        </>}
        onSearchChange={setSearch}
        searchPlaceholder="Usta yoki mijozni qidirish"
        searchValue={search}
      />
      <TableLoadState error={error} isPending={isPending} onRetry={() => { void refetch(); }} />
      {actionError ? <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{actionError}</div> : null}
      {!isPending && (!error || data.length > 0) ? <DataTable columns={columns} data={filteredReviews} /> : null}
    </div>
  );
}
