import { BannersManager } from "@/modules/banners/components/banners-manager";
import { PageHeader } from "@/shared/components/page-header";

export default function BannersPage() {
  return (
    <>
      <PageHeader
        description="Bosh sahifa bannerlari, ularning yo'naltirishi va ko'rsatish tartibi."
        title="Bannerlar"
      />
      <BannersManager />
    </>
  );
}
