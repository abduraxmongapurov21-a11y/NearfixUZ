import { AdminsManager } from "@/modules/admins/components/admins-manager";
import { PageHeader } from "@/shared/components/page-header";

export default function AdminsPage() {
  return (
    <>
      <PageHeader
        description="Admin hisoblari, ularning holati va ruxsatlarini boshqarish."
        title="Adminlar"
      />
      <AdminsManager />
    </>
  );
}
