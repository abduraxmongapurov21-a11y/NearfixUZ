import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

const toneClass = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger"
};

export function StatCard({ label, value, helper, tone = "default" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={cn("mt-3 text-3xl font-semibold tracking-tight", toneClass[tone])}>
          {value}
        </div>
        {helper ? <div className="mt-2 text-xs text-muted-foreground">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}
