import { ReviewsTable } from "@/modules/reviews/components/reviews-table";
import { PageHeader } from "@/shared/components/page-header";

export default function ReviewsPage() {
  return (
    <>
      <PageHeader
        description="Bajarilgan buyurtmalar sharhlarini ko'rish va moderatsiya qilish."
        title="Sharhlar"
      />
      <ReviewsTable />
    </>
  );
}
