import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BannerPlacement } from "../types/banner";

export function BannerPlacementNav({ placement }: { placement: BannerPlacement }) {
  return (
    <nav aria-label="Banner joylashuvi" className="mb-6 flex flex-wrap gap-3">
      <Button asChild variant={placement === "HOME" ? "default" : "outline"}>
        <Link href="/content/banners" aria-current={placement === "HOME" ? "page" : undefined}>Main hero</Link>
      </Button>
      <Button asChild variant={placement === "CATEGORY" ? "default" : "outline"}>
        <Link href="/content/banners/category" aria-current={placement === "CATEGORY" ? "page" : undefined}>Category bannerlari</Link>
      </Button>
    </nav>
  );
}
