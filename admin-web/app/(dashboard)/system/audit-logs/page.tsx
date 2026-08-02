import { AuditLogsTable } from "@/modules/audit/components/audit-logs-table";
import { PageHeader } from "@/shared/components/page-header";

export default function AuditLogsPage() {
  return (
    <>
      <PageHeader
        description="Security and operational admin activity history."
        title="Audit Logs"
      />
      <AuditLogsTable />
    </>
  );
}
