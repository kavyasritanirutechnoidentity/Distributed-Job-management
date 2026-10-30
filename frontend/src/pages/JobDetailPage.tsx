import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Info, RefreshCw } from "lucide-react";
import { useJob, useScheduleJob } from "@/hooks/useJobs";
import { ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDateTime, formatInterval } from "@/lib/utils";

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? "break-all font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export function JobDetailPage() {
  const { id = "" } = useParams();
  const { data: job, isPending, isError, error, refetch } = useJob(id);
  const schedule = useScheduleJob(id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          title="Job not found"
          description="This job may have been removed, or the link is incorrect."
          action={
            <Link to="/jobs" className={buttonVariants({ variant: "outline" })}>
              Back to jobs
            </Link>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const canRetrySchedule = job.scheduleStatus !== "SCHEDULED";

  async function copyScheduleId() {
    if (!job?.temporalScheduleId) return;
    await navigator.clipboard.writeText(job.temporalScheduleId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to jobs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="glow-text text-2xl font-semibold tracking-tight">{job.name}</h1>
            <StatusBadge status={job.scheduleStatus} />
            <Badge variant={job.enabled ? "success" : "default"}>
              {job.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{job.targetUrl}</p>
        </div>
        {canRetrySchedule && (
          <Button onClick={() => setConfirmOpen(true)} disabled={schedule.isPending}>
            <RefreshCw
              className={`h-4 w-4 ${schedule.isPending ? "animate-spin" : ""}`}
              aria-hidden
            />
            {job.scheduleStatus === "FAILED" ? "Retry schedule" : "Create schedule"}
          </Button>
        )}
      </div>

      {job.scheduleStatus === "FAILED" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Temporal schedule creation failed</p>
          <p className="mt-1 text-muted-foreground">
            The job was saved, but the platform could not create its Temporal schedule. Check
            that the Temporal service is reachable, then retry. No executions will run until
            this succeeds.
          </p>
        </div>
      )}

      {schedule.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(schedule.error as Error).message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Job type" value={job.jobType.replace("_", " ")} />
              <Field label="Interval" value={`${formatInterval(job.intervalSeconds)} (${job.intervalSeconds}s)`} />
              <Field label="Target URL" value={job.targetUrl} mono />
              <Field label="Job ID" value={job.id} mono />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">Schedule status</dt>
                <dd className="mt-1">
                  <StatusBadge status={job.scheduleStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Temporal schedule ID</dt>
                <dd className="mt-1 flex items-center gap-1.5">
                  {job.temporalScheduleId ? (
                    <>
                      <span className="break-all font-mono text-sm">
                        {job.temporalScheduleId}
                      </span>
                      <button
                        onClick={copyScheduleId}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Copy schedule ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {copied && <span className="text-xs text-success">Copied</span>}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not created</span>
                  )}
                </dd>
              </div>
              <Field label="Registered" value={formatDateTime(job.createdAt)} />
              <Field label="Last updated" value={formatDateTime(job.updatedAt)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium text-foreground">SCHEDULED</span> means the Temporal
          schedule was created — it does not report whether individual executions succeed.
          The API does not expose per-run execution results yet; check the Temporal UI
          (localhost:8233) for workflow history.
        </p>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={
          job.scheduleStatus === "FAILED" ? "Retry schedule creation?" : "Create schedule?"
        }
        description={`This will ask the backend to create a Temporal schedule for "${job.name}". The request is safe to repeat — the backend no-ops if the schedule already exists.`}
        confirmLabel={job.scheduleStatus === "FAILED" ? "Retry" : "Create"}
        busy={schedule.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => schedule.mutate(undefined, { onSettled: () => setConfirmOpen(false) })}
      />
    </div>
  );
}
