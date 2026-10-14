import { BannersManager } from "@/modules/banners/components/banners-manager";
import { BannerPlacementNav } from "@/modules/banners/components/banner-placement-nav";
import { PageHeader } from "@/shared/components/page-header";

export default function CategoryBannersPage() {
  return (
    <>
      <PageHeader
        description="Kategoriya sahifalarida saralash ostidagi ingichka reklama tasmasi. Main hero bannerlari alohida boshqariladi."
        title="Category bannerlari"
      />
      <BannerPlacementNav placement="CATEGORY" />
      <BannersManager key="CATEGORY" placement="CATEGORY" />
    </>
  );
}
