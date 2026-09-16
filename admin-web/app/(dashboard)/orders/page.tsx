import { OrdersTable } from "@/modules/orders/components/orders-table";
import { PageHeader } from "@/shared/components/page-header";

export default function OrdersPage() {
  return (
    <>
      <PageHeader
        description="Buyurtma jarayoni, javob kutish, to'lov va xizmat holatini kuzatish."
        title="Buyurtmalar"
      />
      <OrdersTable />
    </>
  );
}
