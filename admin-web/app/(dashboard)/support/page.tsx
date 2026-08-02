import { SupportCenter } from "@/modules/support/components/support-center";
import { PageHeader } from "@/shared/components/page-header";

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Support tickets" description="Review client and worker support requests, order context and resolution status." />
      <SupportCenter />
    </>
  );
}
