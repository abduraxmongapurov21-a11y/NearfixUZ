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
  searchPlaceholder = "Qidirish"
}: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Input
        aria-label={searchPlaceholder}
        className="max-w-sm"
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder={searchPlaceholder}
        value={searchValue ?? ""}
      />
      <div className="flex flex-wrap items-center gap-2">{controls}</div>
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      className="h-10 max-w-full rounded-md border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="">{label}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function TableLoadState({ isPending, error, onRetry }: {
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isPending) return <div className="mb-4 text-sm text-muted-foreground" role="status">Ma'lumotlar yuklanmoqda...</div>;
  if (!error) return null;
  return (
    <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">
      <span>{error.message || "Ma'lumotlarni yuklab bo'lmadi."}</span>
      <button className="ml-3 underline" onClick={onRetry} type="button">Qayta urinish</button>
    </div>
  );
}
