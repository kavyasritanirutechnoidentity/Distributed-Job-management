import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useRegisterJob } from "@/hooks/useJobs";
import { ApiError, errorMessage } from "@/lib/api";
import {
  jobRegistrationSchema,
  type Job,
  type JobRegistrationInput,
  type JobRegistrationValues,
} from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { JobFormFields } from "@/components/JobFormFields";

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

const PENDING_REGISTRATION = "job-platform.pending-registration";
type PendingRegistration = { key: string; values: JobRegistrationValues };

function restoreRegistration(): PendingRegistration | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(PENDING_REGISTRATION) ?? "null");
    if (!stored || typeof stored.key !== "string") return null;
    const values = jobRegistrationSchema.safeParse(stored.values);
    return values.success ? { key: stored.key, values: values.data } : null;
  } catch {
    return null;
  }
}

export function RegisterJobPage() {
  const navigate = useNavigate();
  const registerJob = useRegisterJob();
  // One key per logical submission: regenerated only after success or when the
  // form is reset — never per retry.
  const [restored] = useState(restoreRegistration);
  const pending = useRef<PendingRegistration | null>(restored);
  const idempotencyKey = useRef(restored?.key ?? crypto.randomUUID());
  const [created, setCreated] = useState<Job | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobRegistrationInput, unknown, JobRegistrationValues>({
    resolver: zodResolver(jobRegistrationSchema),
    defaultValues: restored?.values ?? { jobType: "HEALTH_CHECK", enabled: true, intervalSeconds: 60 },
  });

  async function onSubmit(values: JobRegistrationValues) {
    if (pending.current && JSON.stringify(pending.current.values) !== JSON.stringify(values)) {
      setError("root", { message: "The previous request has an unknown outcome. Restore its original values and retry before starting a different registration." });
      return;
    }
    pending.current = { key: idempotencyKey.current, values };
    try {
      sessionStorage.setItem(PENDING_REGISTRATION, JSON.stringify(pending.current));
    } catch {
      setError("root", { message: "Browser storage is unavailable. Enable session storage to safely retry registration after a reload." });
      pending.current = null;
      return;
    }
    try {
      const job = await registerJob.mutateAsync({
        values,
        idempotencyKey: idempotencyKey.current,
      });
      setCreated(job);
      sessionStorage.removeItem(PENDING_REGISTRATION);
      pending.current = null;
    } catch (e) {
      if (e instanceof ApiError && [400, 409, 422].includes(e.status)) {
        sessionStorage.removeItem(PENDING_REGISTRATION);
        pending.current = null;
        idempotencyKey.current = crypto.randomUUID();
      }
      if (e instanceof ApiError && e.fieldErrors) {
        for (const [field, message] of Object.entries(e.fieldErrors)) {
          if (field in values) {
            setError(field as keyof JobRegistrationValues, { type: "server", message });
          }
        }
        if (Object.keys(e.fieldErrors).length === 0) setError("root", { message: errorMessage(e) });
      } else {
        setError("root", { message: errorMessage(e) });
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
        <motion.div
          className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-10 text-center shadow-[0_0_40px_hsl(160_84%_45%/0.1)]"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
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
        </motion.div>
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
            <JobFormFields
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
            />

            <FieldError id="registration-error" message={errors.root?.message} />
            {pending.current && errors.root && (
              <Button type="button" variant="outline" onClick={() => reset(pending.current!.values)}>
                Restore original request
              </Button>
            )}
            {serverError && !errors.root && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {errorMessage(serverError)}
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
