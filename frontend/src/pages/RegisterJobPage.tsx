import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useRegisterJob } from "@/hooks/useJobs";
import { ApiError } from "@/lib/api";
import {
  jobRegistrationSchema,
  type Job,
  type JobRegistrationInput,
  type JobRegistrationValues,
} from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function RegisterJobPage() {
  const navigate = useNavigate();
  const registerJob = useRegisterJob();
  // One key per logical submission: regenerated only after success or when the
  // form is reset — never per retry.
  const idempotencyKey = useRef(crypto.randomUUID());
  const [created, setCreated] = useState<Job | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobRegistrationInput, unknown, JobRegistrationValues>({
    resolver: zodResolver(jobRegistrationSchema),
    defaultValues: { jobType: "HEALTH_CHECK", enabled: true, intervalSeconds: 60 },
  });

  async function onSubmit(values: JobRegistrationValues) {
    try {
      const job = await registerJob.mutateAsync({
        values,
        idempotencyKey: idempotencyKey.current,
      });
      setCreated(job);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        for (const [field, message] of Object.entries(e.fieldErrors)) {
          if (field in values) {
            setError(field as keyof JobRegistrationValues, { type: "server", message });
          }
        }
        if (Object.keys(e.fieldErrors).length === 0) throw e;
      } else {
        throw e;
      }
    }
  }

  function resetForm() {
    reset();
    setCreated(null);
    idempotencyKey.current = crypto.randomUUID();
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
          <h1 className="text-xl font-semibold">Job registered</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{created.name}</span> was created
            and is{" "}
            {created.scheduleStatus === "SCHEDULED"
              ? "scheduled in Temporal."
              : created.scheduleStatus === "FAILED"
                ? "saved, but its Temporal schedule could not be created — you can retry from the job page."
                : "pending schedule creation."}
          </p>
          <StatusBadge status={created.scheduleStatus} />
          <div className="mt-4 flex gap-2">
            <Link to={`/jobs/${created.id}`} className={buttonVariants()}>
              View job
            </Link>
            <Button variant="outline" onClick={resetForm}>
              Register another
            </Button>
            <Link to="/jobs" className={buttonVariants({ variant: "ghost" })}>
              All jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const serverError =
    registerJob.isError && !(registerJob.error instanceof ApiError && registerJob.error.fieldErrors)
      ? registerJob.error
      : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to jobs
      </Link>

      <div>
        <h1 className="glow-text text-2xl font-semibold tracking-tight">Register a job</h1>
        <p className="text-sm text-muted-foreground">
          Jobs are scheduled in Temporal as soon as they are registered.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit, () => {})}
            className="space-y-5"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Billing service health check"
                aria-invalid={!!errors.name}
                aria-describedby="name-error"
                {...register("name")}
              />
              <FieldError id="name-error" message={errors.name?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jobType">Job type</Label>
              <Select id="jobType" aria-invalid={!!errors.jobType} {...register("jobType")}>
                <option value="HEALTH_CHECK">Health check — poll a URL on a schedule</option>
              </Select>
              <FieldError id="jobType-error" message={errors.jobType?.message} />
              <p className="text-xs text-muted-foreground">
                Health check is currently the only supported job type.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetUrl">Target URL</Label>
              <Input
                id="targetUrl"
                type="url"
                placeholder="https://example.com/health"
                aria-invalid={!!errors.targetUrl}
                aria-describedby="targetUrl-error"
                {...register("targetUrl")}
              />
              <FieldError id="targetUrl-error" message={errors.targetUrl?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intervalSeconds">Interval (seconds)</Label>
              <Input
                id="intervalSeconds"
                type="number"
                min={10}
                step={1}
                aria-invalid={!!errors.intervalSeconds}
                aria-describedby="intervalSeconds-error intervalSeconds-hint"
                {...register("intervalSeconds")}
              />
              <p id="intervalSeconds-hint" className="text-xs text-muted-foreground">
                Minimum 10 seconds.
              </p>
              <FieldError
                id="intervalSeconds-error"
                message={errors.intervalSeconds?.message}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <input
                id="enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                {...register("enabled")}
              />
              <Label htmlFor="enabled" className="font-normal">
                Enabled — the schedule runs immediately after creation
              </Label>
            </div>

            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {serverError.message}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={isSubmitting || registerJob.isPending}>
                {registerJob.isPending ? "Registering…" : "Register job"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate("/jobs")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
