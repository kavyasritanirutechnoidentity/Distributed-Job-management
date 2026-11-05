import { http, HttpResponse } from "msw";

export function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "health check",
    jobType: "HEALTH_CHECK",
    targetUrl: "https://example.com/health",
    intervalSeconds: 60,
    enabled: true,
    temporalScheduleId: "job-11111111",
    scheduleStatus: "SCHEDULED",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function jobPage(jobs = [makeJob()]) {
  return { content: jobs, totalElements: jobs.length, totalPages: 1, number: 0 };
}

export const handlers = [
  http.post("/api/auth/login", () =>
    HttpResponse.json({ token: "t", username: "admin", role: "ADMIN" })),
  http.post("/api/auth/register", () =>
    HttpResponse.json({ token: "t", username: "nani", role: "VIEWER" })),
  http.get("/api/jobs/dashboard", () =>
    HttpResponse.json({
      total: 1, scheduled: 1, pending: 0, failed: 0, enabled: 1,
      failedRuns24h: 0, recent: [makeJob()], failures: [],
    })),
  http.get("/api/jobs", () => HttpResponse.json(jobPage())),
  http.get("/api/jobs/:id", ({ params }) =>
    HttpResponse.json(makeJob({ id: params.id }))),
  http.get("/api/jobs/:id/executions", () => HttpResponse.json([])),
  http.post("/api/jobs", () => HttpResponse.json(makeJob(), { status: 201 })),
  http.put("/api/jobs/:id", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(makeJob({ id: params.id, ...body }));
  }),
  http.delete("/api/jobs/:id", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/jobs/:id/schedule", ({ params }) =>
    HttpResponse.json(makeJob({ id: params.id }))),
];
