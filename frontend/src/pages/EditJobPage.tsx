import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useJob, useUpdateJob } from "@/hooks/useJobs";
import { ApiError, errorMessage } from "@/lib/api";
import {
  jobRegistrationSchema,
  type Job,
  type JobRegistrationInput,
  type JobRegistrationValues,
} from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/QueryState";
import { JobFormFields } from "@/components/JobFormFields";

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function EditJobPage() {
  const { id = "" } = useParams();
  const { data: job, isPending, error } = useJob(id);

  if (isPending) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!job) {
    return (
      <EmptyState
        title={error instanceof ApiError && error.status === 404 ? "Job not found" : "Could not load job"}
        description="This job may have been removed, or the link is incorrect."
        action={
          <Link to="/jobs" className={buttonVariants({ variant: "outline" })}>
            Back to jobs
          </Link>
        }
      />
    );
  }

  return <EditJobForm key={job.id} job={job} />;
}

function EditJobForm({ job }: { job: Job }) {
  const navigate = useNavigate();
  const updateJob = useUpdateJob(job.id);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobRegistrationInput, unknown, JobRegistrationValues>({
    resolver: zodResolver(jobRegistrationSchema),
    defaultValues: {
      name: job.name,
      jobType: job.jobType,
      targetUrl: job.targetUrl,
      intervalSeconds: job.intervalSeconds,
      enabled: job.enabled,
    },
  });

  async function onSubmit(values: JobRegistrationValues) {
    try {
      const updated = await updateJob.mutateAsync(values);
      navigate(`/jobs/${updated.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        for (const [field, message] of Object.entries(e.fieldErrors)) {
          if (field in values) {
            setError(field as keyof JobRegistrationValues, { type: "server", message });
          }
        }
        if (Object.keys(e.fieldErrors).length === 0) {
          setError("root", { message: errorMessage(e) });
        }
      } else {
        setError("root", { message: errorMessage(e) });
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        to={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to job
      </Link>

      <div>
        <h1 className="glow-text text-2xl font-semibold tracking-tight">Edit job</h1>
        <p className="text-sm text-muted-foreground">
          Changes to scheduled jobs are applied to the Temporal schedule immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <JobFormFields
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
            />

            <FieldError id="update-error" message={errors.root?.message} />

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={isSubmitting || updateJob.isPending}>
                {updateJob.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate(`/jobs/${job.id}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
