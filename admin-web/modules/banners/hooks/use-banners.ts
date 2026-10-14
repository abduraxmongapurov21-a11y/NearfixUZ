"use client";

import { useQuery } from "@tanstack/react-query";
import { getBanners } from "../services/banners-service";
import type { BannerPlacement } from "../types/banner";

export function useBanners(placement: BannerPlacement) {
  return useQuery({
    queryKey: ["banners", placement],
    queryFn: () => getBanners(placement)
  });
}
