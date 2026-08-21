import { UsersTable } from "@/modules/users/components/users-table";
import { PageHeader } from "@/shared/components/page-header";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        description="User list with role visibility and a safe path to prepare client worker applications."
        title="Users"
      />
      <UsersTable />
    </>
  );
}
