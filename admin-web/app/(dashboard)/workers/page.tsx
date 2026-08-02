import { WorkersTable } from "@/modules/workers/components/workers-table";
import { PageHeader } from "@/shared/components/page-header";

export default function WorkersPage() {
  return (
    <>
      <PageHeader
        description="Admin-only worker quality view with availability, response speed, ignored requests and earnings."
        title="Workers"
      />
      <WorkersTable />
    </>
  );
}
