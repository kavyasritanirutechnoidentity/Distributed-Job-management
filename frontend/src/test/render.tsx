import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider, type Role } from "@/lib/auth";

export function makeToken(role: Role = "ADMIN", username = "admin"): string {
  const payload = btoa(
    JSON.stringify({ sub: username, role, exp: Math.floor(Date.now() / 1000) + 3600 }),
  );
  return `h.${payload}.s`;
}

export function login(role: Role = "ADMIN", username = "admin") {
  localStorage.setItem("job-platform.jwt", makeToken(role, username));
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderApp(
  ui: ReactElement,
  options?: RenderOptions & { route?: string },
) {
  const client = makeClient();
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[options?.route ?? "/"]}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

export function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
