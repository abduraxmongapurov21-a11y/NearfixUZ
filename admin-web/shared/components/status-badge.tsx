import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" }> = {
  active: { label: "Active", variant: "success" },
  waiting: { label: "Waiting", variant: "warning" },
  busy: { label: "Busy", variant: "warning" },
  offline: { label: "Offline", variant: "secondary" },
  draft: { label: "NEW", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  suspended: { label: "Suspended", variant: "danger" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
  client: { label: "Client", variant: "secondary" },
  provider: { label: "Provider", variant: "success" },
  published: { label: "Published", variant: "success" },
  hidden: { label: "Hidden", variant: "secondary" }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
