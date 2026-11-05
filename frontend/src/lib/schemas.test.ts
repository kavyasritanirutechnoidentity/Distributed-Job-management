import { describe, expect, it } from "vitest";
import { authResponseSchema, jobPageSchema, jobSchema } from "@/lib/schemas";

const job = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "n",
  jobType: "HEALTH_CHECK",
  targetUrl: "https://a.com",
  intervalSeconds: 10,
  enabled: true,
  temporalScheduleId: "s",
  scheduleStatus: "SCHEDULED",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("schemas", () => {
  it("accepts the backend page object contract", () => {
    const page = { content: [job], totalElements: 1, totalPages: 1, number: 0 };
    expect(jobPageSchema.parse(page).content).toHaveLength(1);
  });

  it("rejects an array where a page object is required", () => {
    expect(() => jobPageSchema.parse([job])).toThrow();
  });

  it("rejects unknown enum values from the backend", () => {
    expect(() => jobSchema.parse({ ...job, scheduleStatus: "BROKEN" })).toThrow();
    expect(() => jobSchema.parse({ ...job, jobType: "EMAIL" })).toThrow();
  });

  it("rejects malformed auth responses", () => {
    expect(() => authResponseSchema.parse({ token: "t", username: "u" })).toThrow();
    expect(() => authResponseSchema.parse({ token: "t", username: "u", role: "SUPERUSER" })).toThrow();
  });
});
