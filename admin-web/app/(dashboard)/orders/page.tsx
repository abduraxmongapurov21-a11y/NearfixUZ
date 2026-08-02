import { OrdersTable } from "@/modules/orders/components/orders-table";
import { PageHeader } from "@/shared/components/page-header";

export default function OrdersPage() {
  return (
    <>
      <PageHeader
        description="Operational radar for service lifecycle, response waiting, payment state and order transparency."
        title="Orders"
      />
      <OrdersTable />
    </>
  );
}
