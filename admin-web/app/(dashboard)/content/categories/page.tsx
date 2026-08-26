import { CategoriesManager } from "@/modules/categories/components/categories-manager";
import { PageHeader } from "@/shared/components/page-header";

export default function CategoriesPage() {
  return <><PageHeader description="Localized mobile categories, icons, status and display order." title="Categories" /><CategoriesManager /></>;
}
