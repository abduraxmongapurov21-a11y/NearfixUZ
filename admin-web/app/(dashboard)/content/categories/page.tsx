import { CategoriesManager } from "@/modules/categories/components/categories-manager";
import { PageHeader } from "@/shared/components/page-header";

export default function CategoriesPage() {
  return <><PageHeader description="Mobil ilovadagi kategoriya nomlari, ikonkalari, holati va ko'rsatish tartibi." title="Kategoriyalar" /><CategoriesManager /></>;
}
