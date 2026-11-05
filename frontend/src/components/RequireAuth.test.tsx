import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderApp, login } from "@/test/render";
import { RequireAdmin, RequireAuth } from "@/components/RequireAuth";

function renderGuarded(route: string) {
  return renderApp(
    <Routes>
      <Route path="/secret" element={<RequireAuth><p>secret</p></RequireAuth>} />
      <Route path="/admin-only" element={<RequireAdmin><p>admin area</p></RequireAdmin>} />
      <Route path="/login" element={<p>login page</p>} />
    </Routes>,
    { route },
  );
}

describe("RequireAuth", () => {
  it("redirects anonymous users to login", async () => {
    renderGuarded("/secret");
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders content for authenticated users", async () => {
    login("VIEWER", "nani");
    renderGuarded("/secret");
    expect(await screen.findByText("secret")).toBeInTheDocument();
  });
});

describe("RequireAdmin", () => {
  it("blocks viewers from admin pages", async () => {
    login("VIEWER", "nani");
    renderGuarded("/admin-only");
    expect(await screen.findByText(/admin access is required/i)).toBeInTheDocument();
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
  });

  it("renders content for admins", async () => {
    login("ADMIN", "admin");
    renderGuarded("/admin-only");
    expect(await screen.findByText("admin area")).toBeInTheDocument();
  });
});
