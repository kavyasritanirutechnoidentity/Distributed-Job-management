import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Activity, Check, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { getTheme, toggleTheme } from "@/lib/theme";
import { ApiError, errorMessage, login, register } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useState } from "react";

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_.-]{3,50}$/, "3-50 characters (letters, digits, _, ., -)");

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: usernameSchema,
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,100}$/,
      "Password does not meet the requirements below",
    ),
});

const passwordRules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "A digit (0-9)", test: (p: string) => /\d/.test(p) },
];

type AuthValues = z.infer<typeof registerSchema>;

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const { user, login: setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState(getTheme);
  const {
    register: field,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
  });
  const password = watch("password") ?? "";

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: AuthValues) => {
    setSubmitError(null);
    try {
      const response = isLogin
        ? await login(values.username, values.password)
        : await register(values.username, values.password);
      setSession(response.token);
      navigate("/", { replace: true });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError && error.status === 409
          ? "That username is already taken."
          : errorMessage(error),
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <button
        type="button"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(toggleTheme())}
        className="fixed right-4 top-4 rounded-xl border border-border bg-card/70 p-2.5 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : (
          <Moon className="h-4 w-4" aria-hidden />
        )}
      </button>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="icon-chip mb-1">
            <Activity className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <CardTitle className="text-lg">
            {isLogin ? "Sign in" : "Create an account"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Distributed Job Management Platform
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" autoFocus {...field("username")} />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="pr-10"
                  {...field("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {isLogin ? (
                errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : (
                <ul className="space-y-1 pt-1">
                  {passwordRules.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${
                          met ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        <Check
                          className={`h-3 w-3 ${met ? "opacity-100" : "opacity-30"}`}
                          aria-hidden
                        />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div aria-live="polite" className={submitError ? undefined : "hidden"}>
              {submitError && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {submitError}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? isLogin ? "Signing in…" : "Creating account…"
                : isLogin ? "Sign in" : "Register"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {isLogin ? (
              <>No account? <Link to="/register" className="text-primary hover:underline">Register</Link></>
            ) : (
              <>Already registered? <Link to="/login" className="text-primary hover:underline">Sign in</Link></>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
