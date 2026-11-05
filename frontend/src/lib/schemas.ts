import { z } from "zod";

// Mirrors backend enums exactly — do not invent values.
export const jobTypeSchema = z.enum(["HEALTH_CHECK"]);
export const scheduleStatusSchema = z.enum(["PENDING", "SCHEDULED", "FAILED"]);

// Mirrors JobResponse record on the backend.
export const jobSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  jobType: jobTypeSchema,
  targetUrl: z.string(),
  intervalSeconds: z.number(),
  enabled: z.boolean(),
  temporalScheduleId: z.string().nullable(),
  scheduleStatus: scheduleStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const jobPageSchema = z.object({
  content: z.array(jobSchema),
  totalElements: z.number(),
  totalPages: z.number(),
  number: z.number(),
});

export const dashboardSchema = z.object({
  total: z.number(), scheduled: z.number(), pending: z.number(),
  failed: z.number(), enabled: z.number(), failedRuns24h: z.number().nullable(),
  recent: z.array(jobSchema), failures: z.array(jobSchema),
});

export type JobPage = z.infer<typeof jobPageSchema>;
export type JobDashboard = z.infer<typeof dashboardSchema>;
export type Job = z.infer<typeof jobSchema>;
export type JobType = z.infer<typeof jobTypeSchema>;
export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;

// Mirrors JobRegistrationRequest validation rules:
// @NotBlank @Size(max=255) name, @NotNull jobType,
// @NotBlank @URL @Size(max=2048) targetUrl, @NotNull @Min(10) intervalSeconds.
export const jobRegistrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  jobType: jobTypeSchema,
  targetUrl: z
    .string()
    .trim()
    .min(1, "Target URL is required")
    .max(2048, "URL must be at most 2048 characters")
    .url("Must be a valid URL (e.g. https://example.com/health)"),
  intervalSeconds: z.coerce
    .number({ invalid_type_error: "Interval must be a number" })
    .int("Interval must be a whole number of seconds")
    .min(10, "Interval must be at least 10 seconds"),
  enabled: z.boolean(),
});

export type JobRegistrationInput = z.input<typeof jobRegistrationSchema>;
export type JobRegistrationValues = z.output<typeof jobRegistrationSchema>;

// Mirrors JobExecutionResponse record on the backend.
export const jobExecutionSchema = z.object({
  workflowId: z.string(),
  status: z.string(),
  startTime: z.string(),
  closeTime: z.string().nullable(),
  durationMs: z.number().nullable(),
});

export type JobExecution = z.infer<typeof jobExecutionSchema>;

// Mirrors AuthResponse record on the backend.
export const authResponseSchema = z.object({
  token: z.string(),
  username: z.string(),
  role: z.enum(["ADMIN", "VIEWER"]),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Backend error shapes from GlobalExceptionHandler.
export const apiErrorSchema = z.object({
  error: z.string(),
  fields: z.record(z.string()).optional(),
});
