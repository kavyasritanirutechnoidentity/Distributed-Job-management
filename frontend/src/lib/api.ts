import { apiErrorSchema, type Job, type JobRegistrationValues } from "./schemas";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the API. Is the backend running on :8080?");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiError(response.status, parsed.data.error, parsed.data.fields);
    }
    throw new ApiError(response.status, `Request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  return data as T;
}

export function getJobs(): Promise<Job[]> {
  return request<Job[]>("/api/jobs");
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

export function scheduleJob(id: string): Promise<Job> {
  return request<Job>(`/api/jobs/${id}/schedule`, { method: "POST" });
}
