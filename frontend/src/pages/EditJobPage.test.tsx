import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderApp, login } from "@/test/render";
import { makeJob } from "@/test/mocks/handlers";
import { EditJobPage } from "@/pages/EditJobPage";

const ID = "11111111-1111-1111-1111-111111111111";

function renderEdit() {
  return renderApp(
    <Routes>
      <Route path="/jobs/:id/edit" element={<EditJobPage />} />
      <Route path="/jobs/:id" element={<p>job detail</p>} />
    </Routes>,
    { route: `/jobs/${ID}/edit` },
  );
}

describe("EditJobPage", () => {
  it("prefills the form from the loaded job", async () => {
    login("ADMIN");
    server.use(http.get(`/api/jobs/${ID}`, () => HttpResponse.json(makeJob({ id: ID }))));
    renderEdit();

    expect(await screen.findByLabelText(/name/i)).toHaveValue("health check");
    expect(screen.getByLabelText(/target url/i)).toHaveValue("https://example.com/health");
  });

  it("does not wipe unsaved edits when the query refetches", async () => {
    login("ADMIN");
    server.use(http.get(`/api/jobs/${ID}`, () => HttpResponse.json(makeJob({ id: ID }))));
    const { client } = renderEdit();
    const user = userEvent.setup();

    const name = await screen.findByLabelText(/name/i);
    await user.clear(name);
    await user.type(name, "renamed by user");

    // simulate the 10s background poll returning fresh data
    server.use(
      http.get(`/api/jobs/${ID}`, () =>
        HttpResponse.json(makeJob({ id: ID, name: "server name" }))),
    );
    await client.invalidateQueries();

    await waitFor(() => expect(name).toHaveValue("renamed by user"));
  });

  it("shows field errors from a failed update", async () => {
    login("ADMIN");
    server.use(
      http.get(`/api/jobs/${ID}`, () => HttpResponse.json(makeJob({ id: ID }))),
      http.put(`/api/jobs/${ID}`, () =>
        HttpResponse.json(
          { error: "validation failed", fields: { name: "taken" } },
          { status: 400 },
        )),
    );
    renderEdit();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("taken")).toBeInTheDocument();
  });
});
