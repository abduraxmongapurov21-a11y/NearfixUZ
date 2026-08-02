"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrders, type AdminOrdersQuery } from "../services/orders-service";

export function useOrders(query: AdminOrdersQuery = {}) {
  return useQuery({
    queryKey: ["orders", query],
    queryFn: () => getOrders(query)
  });
}
