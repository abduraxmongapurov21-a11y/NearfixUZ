import { DashboardOverview } from "@/modules/dashboard/components/dashboard-overview";
import { PageHeader } from "@/shared/components/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        description="Faol buyurtmalar, ustalar bandligi va kunlik xizmat holati bir sahifada."
        title="Bosh sahifa"
      />
      <DashboardOverview />
    </>
  );
}
