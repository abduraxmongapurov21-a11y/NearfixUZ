"use client";

import { useQuery } from "@tanstack/react-query";
import { getBanners } from "../services/banners-service";

export function useBanners() {
  return useQuery({
    queryKey: ["banners"],
    queryFn: getBanners
  });
}
