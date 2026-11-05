import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderApp, login } from "@/test/render";
import { JobsPage } from "@/pages/JobsPage";

function renderJobs() {
  return renderApp(<JobsPage />);
}

describe("JobsPage", () => {
  it("shows admin action icons for each job", async () => {
    login("ADMIN");
    renderJobs();
    expect(await screen.findByRole("button", { name: /edit health check/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete health check/i })).toBeInTheDocument();
  });

  it("hides the actions column from viewers", async () => {
    login("VIEWER", "nani");
    renderJobs();
    expect(await screen.findByText("health check")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete health check/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("keeps the delete dialog open and shows the error on failure", async () => {
    login("ADMIN");
    server.use(
      http.delete("/api/jobs/:id", () =>
        HttpResponse.json({ error: "Only admins can delete jobs" }, { status: 403 })),
    );
    renderJobs();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /delete health check/i }));
    await user.click(screen.getByRole("button", { name: /delete job/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/only admins/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the dialog after successful deletion", async () => {
    login("ADMIN");
    let deleted = 0;
    server.use(
      http.delete("/api/jobs/:id", () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderJobs();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /delete health check/i }));
    await user.click(screen.getByRole("button", { name: /delete job/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleted).toBe(1);
  });

  it("shows the empty state when no jobs exist", async () => {
    login("ADMIN");
    server.use(http.get("/api/jobs", () =>
      HttpResponse.json({ content: [], totalElements: 0, totalPages: 0, number: 0 })));
    renderJobs();
    expect(await screen.findByText(/no jobs registered/i)).toBeInTheDocument();
  });
});
