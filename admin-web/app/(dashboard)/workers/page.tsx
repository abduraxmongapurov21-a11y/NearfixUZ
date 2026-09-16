import { WorkersTable } from "@/modules/workers/components/workers-table";
import { PageHeader } from "@/shared/components/page-header";

export default function WorkersPage() {
  return (
    <>
      <PageHeader
        description="Ustalar sifati, bandligi, javob tezligi, bajarilgan ishlar va daromad ko'rsatkichlari."
        title="Ustalar"
      />
      <WorkersTable />
    </>
  );
}
