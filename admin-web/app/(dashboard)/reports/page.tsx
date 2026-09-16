import { ReportsCenter } from "@/modules/reports/components/reports-center";
import { PageHeader } from "@/shared/components/page-header";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Shikoyatlar moderatsiyasi" description="Shikoyatlarni ko'rib chiqing, sabab va obyektni tekshiring hamda tegishli chorani belgilang." />
      <ReportsCenter />
    </>
  );
}
