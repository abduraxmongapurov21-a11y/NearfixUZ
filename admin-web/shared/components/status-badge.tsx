import { Badge } from "@/components/ui/badge";
import { adminLabel } from "@/lib/admin-labels";

type StatusBadgeProps = {
  status: string;
};

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" }> = {
  active: { label: "Faol", variant: "success" },
  waiting: { label: "Kutilmoqda", variant: "warning" },
  busy: { label: "Band", variant: "warning" },
  offline: { label: "Oflayn", variant: "secondary" },
  draft: { label: "Yangi", variant: "warning" },
  approved: { label: "Tasdiqlangan", variant: "success" },
  suspended: { label: "To'xtatilgan", variant: "danger" },
  completed: { label: "Bajarilgan", variant: "success" },
  cancelled: { label: "Bekor qilingan", variant: "danger" },
  client: { label: "Mijoz", variant: "secondary" },
  provider: { label: "Usta", variant: "success" },
  published: { label: "Ko'rinadi", variant: "success" },
  hidden: { label: "Yashirilgan", variant: "secondary" }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] ?? { label: adminLabel(status), variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
