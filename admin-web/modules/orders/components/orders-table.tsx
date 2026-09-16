"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminLabel } from "@/lib/admin-labels";
import { FilterBar } from "@/shared/components/filter-bar";
import { DataTable } from "@/shared/components/data-table";
import { useWorkers } from "@/modules/workers/hooks/use-workers";
import { useOrders } from "../hooks/use-orders";
import { ordersColumns } from "../tables/orders-columns";
import {
  getOrderDetail,
  runOrderAction,
  type AdminOrderAction,
  type AdminOrdersQuery
} from "../services/orders-service";
import { OrderDetailDrawer } from "./order-detail-drawer";

const pageSize = 20;

const controlClassName =
  "h-10 rounded-md border bg-card px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export function OrdersTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cityId, setCityId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AdminOrderAction | null>(null);
  const queryClient = useQueryClient();
  const { data: workers = [] } = useWorkers();

  useEffect(() => {
    setPage(1);
  }, [search, status, cityId, workerId, fromDate, toDate]);

  const cityOptions = useMemo(() => {
    const values = new Set(["tashkent"]);
    workers.forEach((worker) => {
      if (worker.city && worker.city !== "Kiritilmagan") values.add(worker.city);
    });
    return Array.from(values);
  }, [workers]);

  const query: AdminOrdersQuery = {
    search,
    status,
    cityId,
    workerId,
    fromDate,
    toDate,
    page,
    limit: pageSize
  };
  const { data } = useOrders(query);
  const { data: selectedOrder, isLoading: isDetailLoading } = useQuery({
    enabled: Boolean(selectedOrderId),
    queryKey: ["admin-order-detail", selectedOrderId],
    queryFn: () => getOrderDetail(selectedOrderId!)
  });
  const actionMutation = useMutation({
    mutationFn: ({ orderId, action }: { orderId: string; action: AdminOrderAction }) =>
      runOrderAction(orderId, action),
    onMutate: ({ action }) => {
      setPendingAction(action);
      setActionSuccess(null);
      setActionError(null);
    },
    onError: async (error) => {
      setActionError(error instanceof Error ? error.message : "Buyurtma bo'yicha amal bajarilmadi");
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["orders"] }),
        selectedOrderId
          ? queryClient.refetchQueries({ queryKey: ["admin-order-detail", selectedOrderId] })
          : Promise.resolve()
      ]);
    },
    onSuccess: async (_result, variables) => {
      setActionSuccess("Buyurtma bo'yicha amal muvaffaqiyatli bajarildi.");
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["orders"] }),
        queryClient.refetchQueries({ queryKey: ["admin-order-detail", variables.orderId] })
      ]);
    },
    onSettled: () => {
      setPendingAction(null);
    }
  });
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function openOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setActionSuccess(null);
    setActionError(null);
  }

  function handleAction(action: AdminOrderAction) {
    if (!selectedOrderId || actionMutation.isPending) return;
    actionMutation.mutate({ orderId: selectedOrderId, action });
  }

  return (
    <div>
      <FilterBar
        controls={
          <>
            <select className={controlClassName} onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">Holat</option>
              <option value="waiting">Kutilmoqda</option>
              <option value="active">Faol</option>
              <option value="completed">Bajarilgan</option>
              <option value="cancelled">Bekor qilingan</option>
            </select>
            <select className={controlClassName} onChange={(event) => setCityId(event.target.value)} value={cityId}>
              <option value="">Shahar</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {adminLabel(city)}
                </option>
              ))}
            </select>
            <select className={controlClassName} onChange={(event) => setWorkerId(event.target.value)} value={workerId}>
              <option value="">Usta</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
            <input
              className={controlClassName}
              onChange={(event) => setFromDate(event.target.value)}
              type="date"
              value={fromDate}
            />
            <input
              className={controlClassName}
              onChange={(event) => setToDate(event.target.value)}
              type="date"
              value={toDate}
            />
          </>
        }
        filters={["Holat", "Shahar", "Usta", "Sana"]}
        onSearchChange={setSearch}
        searchPlaceholder="Buyurtma yoki mijozni qidirish"
        searchValue={search}
      />
      <DataTable columns={ordersColumns} data={items} onRowClick={(order) => openOrder(order.orderId)} />
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Jami {data?.total ?? 0} ta buyurtma — {data?.page ?? page} / {totalPages}-sahifa
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} variant="outline">
            Oldingi
          </Button>
          <Button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} variant="outline">
            Keyingi
          </Button>
        </div>
      </div>
      <OrderDetailDrawer
        actionError={actionError}
        actionSuccess={actionSuccess}
        isLoading={isDetailLoading}
        onAction={handleAction}
        onClose={() => setSelectedOrderId(null)}
        open={Boolean(selectedOrderId)}
        order={selectedOrder}
        pendingAction={pendingAction}
      />
    </div>
  );
}
