"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdmins } from "../services/admins-service";

export function useAdmins() {
  return useQuery({
    queryKey: ["admins"],
    queryFn: getAdmins
  });
}
