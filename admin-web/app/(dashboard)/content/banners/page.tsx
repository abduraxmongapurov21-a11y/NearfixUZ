import { BannersManager } from "@/modules/banners/components/banners-manager";
import { PageHeader } from "@/shared/components/page-header";

export default function BannersPage() {
  return (
    <>
      <PageHeader
        description="Home screen banner content, targeting and display order."
        title="Banners"
      />
      <BannersManager />
    </>
  );
}
