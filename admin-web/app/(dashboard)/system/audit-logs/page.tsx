import { AuditLogsTable } from "@/modules/audit/components/audit-logs-table";
import { PageHeader } from "@/shared/components/page-header";

export default function AuditLogsPage() {
  return (
    <>
      <PageHeader
        description="Adminlarning xavfsizlik va boshqaruv bo'yicha amallari tarixi."
        title="Amallar tarixi"
      />
      <AuditLogsTable />
    </>
  );
}
