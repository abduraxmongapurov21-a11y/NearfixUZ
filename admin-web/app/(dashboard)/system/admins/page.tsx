import { AdminsManager } from "@/modules/admins/components/admins-manager";
import { PageHeader } from "@/shared/components/page-header";

export default function AdminsPage() {
  return (
    <>
      <PageHeader
        description="Super admin workspace for admin accounts, status and permissions."
        title="Admins"
      />
      <AdminsManager />
    </>
  );
}
