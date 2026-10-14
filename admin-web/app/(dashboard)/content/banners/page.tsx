import { BannersManager } from "@/modules/banners/components/banners-manager";
import { PageHeader } from "@/shared/components/page-header";
import { BannerPlacementNav } from "@/modules/banners/components/banner-placement-nav";

export default function BannersPage() {
  return (
    <>
      <PageHeader
        description="Bosh sahifaning yuqorisidagi hero bannerlari. Category bannerlari alohida boshqariladi."
        title="Main hero bannerlari"
      />
      <BannerPlacementNav placement="HOME" />
      <BannersManager key="HOME" placement="HOME" />
    </>
  );
}
