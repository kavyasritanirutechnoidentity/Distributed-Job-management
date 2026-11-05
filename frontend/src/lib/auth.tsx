import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Role = "ADMIN" | "VIEWER";
export type AuthUser = { username: string; role: Role };

const TOKEN_KEY = "job-platform.jwt";

type JwtPayload = { sub: string; role: Role; exp: number };

function decode(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part)) as JwtPayload;
    if (!payload.sub || !payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const payload = decode(token);
  if (!payload || payload.exp * 1000 <= Date.now()) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type AuthContextValue = {
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = getToken();
    const payload = token ? decode(token) : null;
    return payload ? { username: payload.sub, role: payload.role } : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (token) => {
        localStorage.setItem(TOKEN_KEY, token);
        const payload = decode(token);
        setUser(payload ? { username: payload.sub, role: payload.role } : null);
      },
      logout: () => {
        clearToken();
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
