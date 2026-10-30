import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpDown, ChevronLeft, ChevronRight, ListChecks, Search } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDateTime, formatInterval } from "@/lib/utils";
import type { Job, ScheduleStatus } from "@/lib/schemas";

const PAGE_SIZE = 10;

type SortKey = "name" | "createdAt" | "intervalSeconds" | "scheduleStatus";
type StatusFilter = "ALL" | ScheduleStatus;
type EnabledFilter = "ALL" | "ENABLED" | "DISABLED";

export function JobsPage() {
  const { data: jobs, isPending, isError, error, refetch } = useJobs();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = search.trim().toLowerCase();
    const result = jobs.filter((j) => {
      if (statusFilter !== "ALL" && j.scheduleStatus !== statusFilter) return false;
      if (enabledFilter === "ENABLED" && !j.enabled) return false;
      if (enabledFilter === "DISABLED" && j.enabled) return false;
      if (q && !j.name.toLowerCase().includes(q) && !j.targetUrl.toLowerCase().includes(q))
        return false;
      return true;
    });
    result.sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "intervalSeconds":
          cmp = a.intervalSeconds - b.intervalSeconds;
          break;
        case "scheduleStatus":
          cmp = a.scheduleStatus.localeCompare(b.scheduleStatus);
          break;
        default:
          cmp = a.createdAt.localeCompare(b.createdAt);
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [jobs, search, statusFilter, enabledFilter, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => toggleSort(k)}
    >
      {label}
      <ArrowUpDown
        className={cn("h-3 w-3", sortKey === k ? "text-primary" : "opacity-40")}
        aria-hidden
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="glow-text text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {jobs ? `${filtered.length} of ${jobs.length} jobs` : "Registered jobs"}
          </p>
        </div>
        <Link to="/jobs/new" className={buttonVariants()}>
          Register job
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Search by name or URL…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            aria-label="Search jobs"
          />
        </div>
        <Select
          className="w-40"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(0);
          }}
          aria-label="Filter by schedule status"
        >
          <option value="ALL">All statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Select
          className="w-40"
          value={enabledFilter}
          onChange={(e) => {
            setEnabledFilter(e.target.value as EnabledFilter);
            setPage(0);
          }}
          aria-label="Filter by enabled state"
        >
          <option value="ALL">All states</option>
          <option value="ENABLED">Enabled</option>
          <option value="DISABLED">Disabled</option>
        </Select>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : pageRows.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-10 w-10 text-muted-foreground" aria-hidden />}
          title={jobs.length === 0 ? "No jobs registered" : "No jobs match your filters"}
          description={
            jobs.length === 0
              ? "Register your first health-check job."
              : "Try adjusting the search or filters."
          }
        />
      ) : (
        <>
          <div className="glass overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(217_80%_60%/0.14)] bg-[hsl(217_60%_18%/0.3)] text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    <SortHeader label="Name" k="name" />
                  </th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">
                    <SortHeader label="Interval" k="intervalSeconds" />
                  </th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">
                    <SortHeader label="Status" k="scheduleStatus" />
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <SortHeader label="Created" k="createdAt" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((job: Job) => (
                  <tr
                    key={job.id}
                    className="cursor-pointer transition-colors hover:bg-[hsl(217_80%_60%/0.06)]"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <td className="max-w-48 truncate px-4 py-3 font-medium">{job.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{job.jobType.replace("_", " ")}</Badge>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                      {job.targetUrl}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatInterval(job.intervalSeconds)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={job.enabled ? "success" : "default"}>
                        {job.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.scheduleStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(job.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {safePage + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
                </button>
                <button
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
