import { ReviewsTable } from "@/modules/reviews/components/reviews-table";
import { PageHeader } from "@/shared/components/page-header";

export default function ReviewsPage() {
  return (
    <>
      <PageHeader
        description="Completed-order review visibility for trust monitoring and future moderation workflows."
        title="Reviews"
      />
      <ReviewsTable />
    </>
  );
}
