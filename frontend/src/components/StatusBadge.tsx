import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ScheduleStatus } from "@/lib/schemas";

const config: Record<
  ScheduleStatus,
  { variant: "success" | "warning" | "destructive"; icon: typeof Clock; label: string }
> = {
  SCHEDULED: { variant: "success", icon: CheckCircle2, label: "Scheduled" },
  PENDING: { variant: "warning", icon: Clock, label: "Pending" },
  FAILED: { variant: "destructive", icon: XCircle, label: "Failed" },
};

export function StatusBadge({ status }: { status: ScheduleStatus }) {
  const { variant, icon: Icon, label } = config[status];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
