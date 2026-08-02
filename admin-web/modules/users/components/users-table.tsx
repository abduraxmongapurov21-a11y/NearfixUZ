"use client";

import { DataTable } from "@/shared/components/data-table";
import { FilterBar } from "@/shared/components/filter-bar";
import { useUsers } from "../hooks/use-users";
import { usersColumns } from "../tables/users-columns";

export function UsersTable() {
  const { data = [] } = useUsers();

  return (
    <div>
      <FilterBar filters={["Role", "City", "Registered"]} searchPlaceholder="User yoki telefon qidirish" />
      <DataTable columns={usersColumns} data={data} />
    </div>
  );
}
