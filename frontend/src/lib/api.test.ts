import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { ApiError, deleteJob, getJob, getJobs, login } from "@/lib/api";
import { login as seedToken } from "@/test/render";

describe("api client", () => {
  it("attaches the bearer token to requests", async () => {
    seedToken("ADMIN", "admin");
    let auth: string | null = null;
    server.use(
      http.get("/api/jobs/:id", ({ request }) => {
        auth = request.headers.get("Authorization");
        return HttpResponse.json({
          id: "x", name: "n", jobType: "HEALTH_CHECK", targetUrl: "https://a.com",
          intervalSeconds: 10, enabled: true, temporalScheduleId: "s",
          scheduleStatus: "SCHEDULED", createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        });
      }),
    );
    await getJob("x");
    expect(auth).toMatch(/^Bearer h\./);
  });

  it("maps backend error bodies to ApiError", async () => {
    server.use(
      http.get("/api/jobs", () =>
        HttpResponse.json({ error: "boom", fields: { name: "taken" } }, { status: 409 })),
    );
    const err = await getJobs().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.message).toBe("boom");
    expect(err.fieldErrors).toEqual({ name: "taken" });
  });

  it("returns a friendly message for non-contract error bodies", async () => {
    server.use(http.get("/api/jobs", () => HttpResponse.text("oops", { status: 500 })));
    const err = await getJobs().catch((e) => e);
    expect(err.message).toContain("temporarily unavailable");
  });

  it("clears the token and throws on 401", async () => {
    seedToken("ADMIN", "admin");
    server.use(http.get("/api/jobs", () => HttpResponse.json({ error: "expired" }, { status: 401 })));
    const err = await getJobs().catch((e) => e);
    expect(err.status).toBe(401);
    expect(localStorage.getItem("job-platform.jwt")).toBeNull();
  });

  it("returns undefined for 204 responses", async () => {
    await expect(deleteJob("x")).resolves.toBeUndefined();
  });

  it("parses auth responses through the schema", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ token: "t", username: "a", role: "SUPERUSER" })),
    );
    await expect(login("a", "b")).rejects.toThrow();
  });
});
