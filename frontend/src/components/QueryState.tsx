import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message = errorMessage(error);
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </Button>
      )}
    </div>
  );
}

export function StaleDataWarning({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="status" className="rounded-lg border border-warning/30 p-3 text-sm text-muted-foreground">
      Showing previously loaded data. {errorMessage(error)}{" "}
      <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-12 text-center">
      {icon}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
