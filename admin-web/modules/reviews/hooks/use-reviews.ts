"use client";

import { useQuery } from "@tanstack/react-query";
import { getReviews } from "../services/reviews-service";

export function useReviews() {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: getReviews
  });
}
