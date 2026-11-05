import {
  apiErrorSchema,
  type Job,
  type JobExecution,
  type JobRegistrationValues,
} from "./schemas";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === "ZodError") {
    return "The server returned an unexpected response. Please ensure the backend is up to date.";
  }
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(35_000),
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Cannot connect to the server or the request timed out. Please retry. Registration retries reuse the same request key.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiError(response.status, parsed.data.error, parsed.data.fields);
    }
    throw new ApiError(response.status, response.status >= 500
      ? "The server is temporarily unavailable. Please try again."
      : `Request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  return data as T;
}

export type JobListParams = {
  page?: number; size?: number; search?: string; status?: string;
  enabled?: boolean; sort?: string; direction?: string;
};

export function getJobs(params: JobListParams = {}): Promise<import("./schemas").JobPage> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return request(`/api/jobs?${query}`);
}

export function getDashboard(): Promise<import("./schemas").JobDashboard> {
  return request("/api/jobs/dashboard");
}

export function getJob(id: string): Promise<Job> {
  return request<Job>(`/api/jobs/${id}`);
}

export function registerJob(
  values: JobRegistrationValues,
  idempotencyKey: string,
): Promise<Job> {
  return request<Job>("/api/jobs", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(values),
  });
}

export function getJobExecutions(id: string): Promise<JobExecution[]> {
  return request<JobExecution[]>(`/api/jobs/${id}/executions`);
}

export function scheduleJob(id: string): Promise<Job> {
  return request<Job>(`/api/jobs/${id}/schedule`, { method: "POST" });
}
