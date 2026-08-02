import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterBarProps = {
  controls?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: string[];
};

export function FilterBar({
  controls,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Qidirish",
  filters = ["Status", "City", "Date"]
}: FilterBarProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <Input
        className="max-w-sm"
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder={searchPlaceholder}
        value={searchValue}
      />
      <div className="flex items-center gap-2">
        {controls ??
          filters.map((filter) => (
            <Button key={filter} variant="outline">
              {filter}
            </Button>
          ))}
      </div>
    </div>
  );
}
