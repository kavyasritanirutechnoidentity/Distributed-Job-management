import { Globe, Link2, Tag, Timer } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { JobRegistrationInput } from "@/lib/schemas";

const INTERVAL_PRESETS = [
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "1h", value: 3600 },
];

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      {children}
    </span>
  );
}

export function JobFormFields({
  register,
  errors,
  watch,
  setValue,
}: {
  register: UseFormRegister<JobRegistrationInput>;
  errors: FieldErrors<JobRegistrationInput>;
  watch: UseFormWatch<JobRegistrationInput>;
  setValue: UseFormSetValue<JobRegistrationInput>;
}) {
  const interval = Number(watch("intervalSeconds"));

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <div className="relative">
          <FieldIcon>
            <Tag className="h-4 w-4" aria-hidden />
          </FieldIcon>
          <Input
            id="name"
            className="pl-9"
            placeholder="e.g. Billing service health check"
            aria-invalid={!!errors.name}
            aria-describedby="name-error"
            {...register("name")}
          />
        </div>
        <FieldError id="name-error" message={errors.name?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="jobType">Job type</Label>
        <Select id="jobType" aria-invalid={!!errors.jobType} {...register("jobType")}>
          <option value="HEALTH_CHECK">Health check — poll a URL on a schedule</option>
        </Select>
        <FieldError id="jobType-error" message={errors.jobType?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetUrl">Target URL</Label>
        <div className="relative">
          <FieldIcon>
            <Globe className="h-4 w-4" aria-hidden />
          </FieldIcon>
          <Input
            id="targetUrl"
            type="url"
            className="pl-9 font-mono text-[13px]"
            placeholder="https://example.com/health"
            aria-invalid={!!errors.targetUrl}
            aria-describedby="targetUrl-error"
            {...register("targetUrl")}
          />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 className="h-3 w-3" aria-hidden />
          Public HTTP(S) endpoints only — private addresses and redirects are rejected.
        </p>
        <FieldError id="targetUrl-error" message={errors.targetUrl?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="intervalSeconds">Interval</Label>
        <div className="relative">
          <FieldIcon>
            <Timer className="h-4 w-4" aria-hidden />
          </FieldIcon>
          <Input
            id="intervalSeconds"
            type="number"
            min={10}
            step={1}
            className="pl-9"
            aria-invalid={!!errors.intervalSeconds}
            aria-describedby="intervalSeconds-error intervalSeconds-hint"
            {...register("intervalSeconds")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {INTERVAL_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() =>
                setValue("intervalSeconds", preset.value, { shouldValidate: true })
              }
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                interval === preset.value
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          ))}
          <span id="intervalSeconds-hint" className="ml-1 text-xs text-muted-foreground">
            seconds, min 10
          </span>
        </div>
        <FieldError id="intervalSeconds-error" message={errors.intervalSeconds?.message} />
      </div>

      <label
        htmlFor="enabled"
        className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/30"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">Enabled</span>
          <span className="block text-xs text-muted-foreground">
            The schedule starts firing as soon as it is created
          </span>
        </span>
        <span className="relative inline-flex">
          <input id="enabled" type="checkbox" className="peer sr-only" {...register("enabled")} />
          <span
            aria-hidden
            className="h-6 w-11 rounded-full bg-muted transition-colors duration-200 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-5"
          />
        </span>
      </label>
    </>
  );
}
