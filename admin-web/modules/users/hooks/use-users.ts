"use client";

import { useQuery } from "@tanstack/react-query";
import { getUsers } from "../services/users-service";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: getUsers
  });
}
