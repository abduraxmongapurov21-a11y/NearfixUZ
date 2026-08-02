import { DashboardOverview } from "@/modules/dashboard/components/dashboard-overview";
import { PageHeader } from "@/shared/components/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        description="Active orders, worker capacity and daily service health in one lightweight operations view."
        title="Dashboard"
      />
      <DashboardOverview />
    </>
  );
}
