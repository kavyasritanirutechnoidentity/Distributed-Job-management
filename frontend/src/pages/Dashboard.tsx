import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ListChecks,
  PlusCircle,
  Power,
  PowerOff,
  XCircle,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useQueries } from "@tanstack/react-query";
import { z } from "zod";
import { useDashboard, jobKeys } from "@/hooks/useJobs";
import { getJobExecutions } from "@/lib/api";
import { jobExecutionSchema } from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, StaleDataWarning } from "@/components/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { formatInterval, formatRelative } from "@/lib/utils";
import type { Job, JobExecution, ScheduleStatus } from "@/lib/schemas";

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  SCHEDULED: "hsl(160 84% 45%)",
  PENDING: "hsl(38 95% 55%)",
  FAILED: "hsl(0 80% 58%)",
};

const TONE_STYLES = {
  neutral: { text: "text-foreground", chip: "" },
  success: {
    text: "text-success",
    chip: "!bg-none bg-success/15 shadow-[0_0_20px_hsl(160_84%_45%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.1)]",
  },
  warning: {
    text: "text-warning",
    chip: "!bg-none bg-warning/15 shadow-[0_0_20px_hsl(38_95%_55%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.1)]",
  },
  destructive: {
    text: "text-destructive",
    chip: "!bg-none bg-destructive/15 shadow-[0_0_20px_hsl(0_80%_58%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.1)]",
  },
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  icon: typeof Clock;
  tone?: keyof typeof TONE_STYLES;
}) {
  const s = TONE_STYLES[tone];
  return (
    <Card className="lift">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={`glow-text mt-1.5 text-3xl font-semibold tabular-nums ${s.text}`}>
            {value}
          </p>
        </div>
        <span className={`icon-chip ${s.chip}`}>
          <Icon className={`h-5 w-5 ${s.text}`} aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}

function FailureRow({ job }: { job: Job }) {
  return (
    <li className="group flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-[hsl(217_80%_60%/0.05)]">
      <div className="min-w-0">
        <Link
          to={`/jobs/${job.id}`}
          className="block truncate font-medium hover:text-primary"
        >
          {job.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          Schedule creation failed · updated {formatRelative(job.updatedAt)}
        </p>
      </div>
      <Link
        to={`/jobs/${job.id}`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Recover <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </li>
  );
}

export function Dashboard() {
  const { data: dashboard, isPending, isError, error, refetch } = useDashboard();
  const jobs = dashboard?.recent;

  const executionQueries = useQueries({
    queries: (jobs ?? []).map((j) => ({
      queryKey: jobKeys.executions(j.id),
      queryFn: async () => z.array(jobExecutionSchema).parse(await getJobExecutions(j.id)),
      refetchInterval: 15_000,
    })),
  });

  const recentExecutions: (JobExecution & { jobName: string })[] = (jobs ?? [])
    .flatMap((j, i) =>
      (executionQueries[i]?.data ?? []).map((ex) => ({ ...ex, jobName: j.name })),
    )
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 8);

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!dashboard) return <ErrorState error={error} onRetry={() => refetch()} />;

  const { total, scheduled, pending, failed, enabled, failedRuns24h, recent, failures } = dashboard;
  const counts = { SCHEDULED: scheduled, PENDING: pending, FAILED: failed };
  const chartData = (["SCHEDULED", "PENDING", "FAILED"] as const)
    .map((s) => ({ name: s, value: counts[s] }))
    .filter((d) => d.value > 0);

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="glow-text text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Scheduling health across registered jobs
          </p>
        </div>
        <Link to="/jobs/new" className={buttonVariants()}>
          <PlusCircle className="h-4 w-4" aria-hidden /> Register job
        </Link>
      </div>

      {isError && <StaleDataWarning error={error} onRetry={() => refetch()} />}
      {total === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-10 w-10 text-muted-foreground" aria-hidden />}
          title="No jobs registered yet"
          description="Register your first health-check job to start scheduling."
          action={
            <Link to="/jobs/new" className={`mt-2 ${buttonVariants()}`}>
              Register a job
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[
              { label: "Total jobs", value: total, icon: ListChecks, tone: "neutral" as const },
              { label: "Scheduled", value: scheduled, icon: CheckCircle2, tone: "success" as const },
              { label: "Pending", value: pending, icon: Clock, tone: "warning" as const },
              { label: "Schedule failures", value: failed, icon: AlertTriangle, tone: "destructive" as const },
              {
                label: "Failed runs (24h)",
                value: failedRuns24h ?? "—",
                icon: XCircle,
                tone: "destructive" as const,
              },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <StatCard label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Schedule status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={75}
                        strokeWidth={2}
                      >
                        {chartData.map((d) => (
                          <Cell
                            key={d.name}
                            fill={STATUS_COLORS[d.name as ScheduleStatus]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(224 55% 9% / 0.9)",
                          border: "1px solid hsl(217 80% 60% / 0.2)",
                          borderRadius: 12,
                          fontSize: 12,
                          backdropFilter: "blur(8px)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="glow-text text-3xl font-semibold tabular-nums">{total}</span>
                    <span className="text-xs text-muted-foreground">jobs</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-center gap-6 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Power className="h-3.5 w-3.5 text-success" aria-hidden /> {enabled} enabled
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <PowerOff className="h-3.5 w-3.5" aria-hidden /> {total - enabled} disabled
                  </span>
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Schedule registration health — run results are in Failed runs and the feed.
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Needs attention</CardTitle>
                {failures.length > 0 && (
                  <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
                )}
              </CardHeader>
              <CardContent>
                {failures.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No failed schedules. Everything is healthy.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {failures.map((j) => (
                      <FailureRow key={j.id} job={j} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Execution feed — six recently updated jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {recentExecutions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No executions recorded yet — runs appear here as schedules fire.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentExecutions.map((ex) => (
                    <li
                      key={ex.workflowId}
                      className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5 transition-colors duration-200 hover:bg-[hsl(217_80%_60%/0.05)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            ex.status === "COMPLETED"
                              ? "bg-success"
                              : ex.status === "RUNNING"
                                ? "bg-primary"
                                : "bg-destructive pulse-dot"
                          }`}
                          aria-hidden
                        />
                        <span className="truncate text-sm">{ex.jobName}</span>
                        <span className="hidden truncate font-mono text-xs text-muted-foreground sm:inline">
                          {ex.status.toLowerCase().replace("_", " ")}
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
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent activity</CardTitle>
              <Link to="/jobs" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {recent.map((j) => (
                  <li
                    key={j.id}
                    className="group flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors duration-200 hover:bg-[hsl(217_80%_60%/0.05)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <StatusBadge status={j.scheduleStatus} />
                      <Link
                        to={`/jobs/${j.id}`}
                        className="truncate font-medium hover:text-primary"
                      >
                        {j.name}
                      </Link>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatInterval(j.intervalSeconds)}</span>
                      <span>{formatRelative(j.updatedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
