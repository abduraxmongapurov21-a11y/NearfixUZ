import { ReportsCenter } from "@/modules/reports/components/reports-center";
import { PageHeader } from "@/shared/components/page-header";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports moderation" description="Review abuse reports, inspect target context, record decisions and take moderation action." />
      <ReportsCenter />
    </>
  );
}
