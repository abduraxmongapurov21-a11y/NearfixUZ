import { UsersTable } from "@/modules/users/components/users-table";
import { PageHeader } from "@/shared/components/page-header";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        description="Foydalanuvchilar ro'yxati, ularning roli va mijozni usta arizasiga tayyorlash imkoniyati."
        title="Foydalanuvchilar"
      />
      <UsersTable />
    </>
  );
}
