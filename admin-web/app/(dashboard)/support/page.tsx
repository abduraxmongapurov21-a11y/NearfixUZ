import { SupportCenter } from "@/modules/support/components/support-center";
import { PageHeader } from "@/shared/components/page-header";

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Yordam murojaatlari" description="Mijoz va ustalarning murojaatlari, buyurtma tafsilotlari hamda yechim holatini ko'ring." />
      <SupportCenter />
    </>
  );
}
