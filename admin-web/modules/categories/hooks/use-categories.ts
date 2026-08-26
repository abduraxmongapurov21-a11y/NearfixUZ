"use client";

import { useQuery } from "@tanstack/react-query";
import { getCategories } from "../services/categories-service";

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: getCategories });
}
