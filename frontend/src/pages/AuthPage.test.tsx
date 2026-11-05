import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderApp } from "@/test/render";
import { AuthPage } from "@/pages/AuthPage";

function renderAuth(mode: "login" | "register") {
  return renderApp(
    <Routes>
      <Route path="/login" element={<AuthPage mode={mode} />} />
      <Route path="/register" element={<AuthPage mode={mode} />} />
      <Route path="/" element={<p>dashboard</p>} />
    </Routes>,
    { route: mode === "login" ? "/login" : "/register" },
  );
}

describe("AuthPage login", () => {
  it("signs in and navigates to the dashboard", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ token: "jwt.tok.en", username: "admin", role: "ADMIN" })),
    );
    renderAuth("login");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/^password$/i), "admin123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("shows the server error on invalid credentials", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ error: "Invalid username or password" }, { status: 401 })),
    );
    renderAuth("login");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/^password$/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    renderAuth("login");
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^password$/i);

    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");
  });
});

describe("AuthPage register", () => {
  it("shows the live password checklist", async () => {
    renderAuth("register");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^password$/i), "weak");
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/an uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/a digit/i)).toBeInTheDocument();
  });

  it("registers a viewer and navigates to the dashboard", async () => {
    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json({ token: "jwt.tok.en", username: "nani", role: "VIEWER" })),
    );
    renderAuth("register");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "nani");
    await user.type(screen.getByLabelText(/^password$/i), "Passw0rd1");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });
});
