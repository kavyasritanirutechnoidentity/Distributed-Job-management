import { clearToken, getToken } from "./auth";
import {
  apiErrorSchema,
  authResponseSchema,
  type AuthResponse,
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
    const token = getToken();
    response = await fetch(path, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(35_000),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Cannot connect to the server or the request timed out. Please retry. Registration retries reuse the same request key.");
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    const body = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiError(response.status, parsed.data.error, parsed.data.fields);
    }
    throw new ApiError(response.status, response.status >= 500
      ? "The server is temporarily unavailable. Please try again."
      : `Request failed with status ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
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

export function updateJob(id: string, values: JobRegistrationValues): Promise<Job> {
  return request<Job>(`/api/jobs/${id}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
}

export function deleteJob(id: string): Promise<void> {
  return request<void>(`/api/jobs/${id}`, { method: "DELETE" });
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return authResponseSchema.parse(data);
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return authResponseSchema.parse(data);
}
