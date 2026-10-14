"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/shared/components/data-table";
import { FilterBar, FilterSelect, TableLoadState } from "@/shared/components/filter-bar";
import { getFilterOptions, matchesTableSearch } from "@/shared/utils/table-filters";
import { useAdminUiStore } from "@/stores/ui-store";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { hasPermission } from "@/shared/auth/permissions";
import { apiClient, getAdminToken } from "@/services/api-client";
import { adminLabel } from "@/lib/admin-labels";
import { useUsers } from "../hooks/use-users";
import { usersColumns } from "../tables/users-columns";
import type { AdminUser } from "../types/user";

export function UsersTable() {
  const { data = [], error, isPending, refetch } = useUsers();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const queryClient = useQueryClient();
  const globalSearch = useAdminUiStore((state) => state.globalSearch);
  const canManage = useAdminSessionStore((state) => hasPermission(state.session, "users.manage"));
  const promotion = useMutation({
    mutationFn: async (userId: string) => {
      const token = getAdminToken();
      if (!token) throw new Error("Admin sifatida kirish talab qilinadi");
      await apiClient(`/admin/users/${userId}/promote-provider`, {
        method: "POST", token, body: JSON.stringify({})
      });
    },
    onMutate: () => {
      setActionError("");
      setActionSuccess("");
    },
    onError: (value) => setActionError(value instanceof Error ? value.message : "Usta arizasini tayyorlab bo'lmadi."),
    onSuccess: async () => {
      setActionSuccess("Usta arizasi uchun profil tayyorlandi.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["workers"] })
      ]);
    }
  });
  const columns: ColumnDef<AdminUser>[] = [
    ...usersColumns,
    {
      id: "actions",
      header: "Amal",
      cell: ({ row }) => row.original.role === "client" ? (
        <Button
          disabled={!canManage || promotion.isPending}
          onClick={() => {
            if (!canManage || promotion.isPending) return;
            promotion.mutate(row.original.id);
          }}
          size="sm"
          variant="outline"
        >
          {promotion.isPending && promotion.variables === row.original.id ? "Tayyorlanmoqda..." : "Usta arizasiga tayyorlash"}
        </Button>
      ) : <span className="text-xs text-muted-foreground">{row.original.role === "provider" ? "Usta huquqi faol" : adminLabel(row.original.role)}</span>
    }
  ];
  const filteredUsers = data.filter((user) =>
    (!role || user.role === role) && (!city || user.city === city) && (!date || user.registeredAt === date) &&
    matchesTableSearch([user.name, user.phone, user.city, adminLabel(user.city), adminLabel(user.role)], [search, globalSearch])
  );

  return (
    <div>
      <FilterBar
        controls={<>
          <FilterSelect label="Rol" onChange={setRole} options={getFilterOptions(data.map((user) => user.role), adminLabel)} value={role} />
          <FilterSelect label="Shahar" onChange={setCity} options={getFilterOptions(data.map((user) => user.city), adminLabel)} value={city} />
          <FilterSelect label="Ro'yxatdan o'tgan sana" onChange={setDate} options={getFilterOptions(data.map((user) => user.registeredAt))} value={date} />
        </>}
        onSearchChange={setSearch}
        searchPlaceholder="Foydalanuvchi yoki telefonni qidirish"
        searchValue={search}
      />
      <TableLoadState error={error} isPending={isPending} onRetry={() => { void refetch(); }} />
      {actionError ? <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{actionError}</div> : null}
      {actionSuccess ? <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">{actionSuccess}</div> : null}
      {!isPending && (!error || data.length > 0) ? <DataTable columns={columns} data={filteredUsers} /> : null}
    </div>
  );
}
