"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkers } from "../services/workers-service";

export function useWorkers() {
  return useQuery({
    queryKey: ["workers"],
    queryFn: getWorkers
  });
}
