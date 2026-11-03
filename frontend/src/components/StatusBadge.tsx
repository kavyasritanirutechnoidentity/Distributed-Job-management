import { Badge } from "@/components/ui/badge";
import type { ScheduleStatus } from "@/lib/schemas";

const config: Record<
  ScheduleStatus,
  { variant: "success" | "warning" | "destructive"; label: string; pulse: boolean }
> = {
  SCHEDULED: { variant: "success", label: "Scheduled", pulse: false },
  PENDING: { variant: "warning", label: "Pending", pulse: true },
  FAILED: { variant: "destructive", label: "Failed", pulse: true },
};

export function StatusBadge({ status }: { status: ScheduleStatus }) {
  const { variant, label, pulse } = config[status];
  return (
    <Badge variant={variant}>
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "pulse-dot" : ""}`}
        aria-hidden
      />
      {label}
    </Badge>
  );
}
