import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, Info, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useJob, useJobExecutions, useScheduleJob, useDeleteJob } from "@/hooks/useJobs";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, StaleDataWarning } from "@/components/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDateTime, formatInterval, formatRelative } from "@/lib/utils";

const TEMPORAL_UI =
  import.meta.env.VITE_TEMPORAL_UI_URL ?? "http://localhost:8233";
const temporalNs = "default";

function executionStatusVariant(status: string): "success" | "destructive" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "RUNNING") return "info";
  return "destructive";
}

function ExecutionsCard({ jobId }: { jobId: string }) {
  const { data, isPending, isError, error, refetch } = useJobExecutions(jobId);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent executions</CardTitle>
        <a
          href={`${TEMPORAL_UI}/namespaces/${temporalNs}/schedules`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          Full history in Temporal UI <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </CardHeader>
      <CardContent>
        {isError && data && <StaleDataWarning error={error} onRetry={() => refetch()} />}
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : !data ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No executions yet — the first run happens on the next interval tick.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((ex) => (
              <li
                key={ex.workflowId}
                className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5 transition-colors duration-200 hover:bg-[hsl(217_80%_60%/0.05)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Badge variant={executionStatusVariant(ex.status)}>
                    {ex.status.toLowerCase().replace("_", " ")}
                  </Badge>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {ex.workflowId.replace(/^health-check-[0-9a-f-]+-/, "")}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                  {ex.durationMs != null && (
                    <span className="tabular-nums">
                      {ex.durationMs < 1000
                        ? `${ex.durationMs}ms`
                        : `${(ex.durationMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  <span>{formatRelative(ex.startTime)}</span>
                  <a
                    href={`${TEMPORAL_UI}/namespaces/${temporalNs}/workflows/${ex.workflowId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    aria-label="Open workflow in Temporal UI"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

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
  const deleteJob = useDeleteJob();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  if (!job) {
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
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to jobs
      </Link>

      {isError && <StaleDataWarning error={error} onRetry={() => refetch()} />}
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
        {isAdmin && (
          <div className="flex gap-2">
            {canRetrySchedule && (
              <Button onClick={() => setConfirmOpen(true)} disabled={schedule.isPending}>
                <RefreshCw
                  className={`h-4 w-4 ${schedule.isPending ? "animate-spin" : ""}`}
                  aria-hidden
                />
                {job.scheduleStatus === "FAILED" ? "Retry schedule" : "Create schedule"}
              </Button>
            )}
            <Link
              to={`/jobs/${job.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
              aria-label="Edit job"
              title="Edit job"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete job"
              title="Delete job"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
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
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Copy schedule ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={`${TEMPORAL_UI}/namespaces/${temporalNs}/schedules/${job.temporalScheduleId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                        aria-label="Open schedule in Temporal UI"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
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

      <ExecutionsCard jobId={job.id} />

      <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium text-foreground">SCHEDULED</span> means the Temporal
          schedule exists and fires on its interval — check the execution list above for
          whether individual runs actually succeeded.
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
        error={schedule.isError ? errorMessage(schedule.error) : undefined}
        onCancel={() => {
          setConfirmOpen(false);
          schedule.reset();
        }}
        onConfirm={() => {
          if (schedule.isPending) return;
          schedule.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${job.name}"?`}
        description="This permanently removes the job and its Temporal schedule. Execution history in Temporal is not deleted. This action cannot be undone."
        confirmLabel="Delete job"
        confirmVariant="destructive"
        busy={deleteJob.isPending}
        error={deleteJob.isError ? errorMessage(deleteJob.error) : undefined}
        onCancel={() => {
          setDeleteOpen(false);
          deleteJob.reset();
        }}
        onConfirm={() =>
          !deleteJob.isPending &&
          deleteJob.mutate(job.id, {
            onSuccess: () => navigate("/jobs", { replace: true }),
          })
        }
      />
    </motion.div>
  );
}
