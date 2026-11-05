import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/lib/auth";
import { RequireAdmin, RequireAuth } from "@/components/RequireAuth";
import { AuthPage } from "@/pages/AuthPage";

const Dashboard = lazy(() =>
  import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const JobsPage = lazy(() => import("@/pages/JobsPage").then((m) => ({ default: m.JobsPage })));
const JobDetailPage = lazy(() =>
  import("@/pages/JobDetailPage").then((m) => ({ default: m.JobDetailPage })),
);
const RegisterJobPage = lazy(() =>
  import("@/pages/RegisterJobPage").then((m) => ({ default: m.RegisterJobPage })),
);
const EditJobPage = lazy(() =>
  import("@/pages/EditJobPage").then((m) => ({ default: m.EditJobPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000 },
  },
});

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64" />
    </div>
  );
}

function withSuspense(node: React.ReactNode) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>{node}</Suspense>
    </ErrorBoundary>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <AuthPage mode="login" /> },
  { path: "/register", element: <AuthPage mode="register" /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: withSuspense(<Dashboard />) },
      { path: "/jobs", element: withSuspense(<JobsPage />) },
      {
        path: "/jobs/new",
        element: withSuspense(
          <RequireAdmin>
            <RegisterJobPage />
          </RequireAdmin>,
        ),
      },
      { path: "/jobs/:id", element: withSuspense(<JobDetailPage />) },
      {
        path: "/jobs/:id/edit",
        element: withSuspense(
          <RequireAdmin>
            <EditJobPage />
          </RequireAdmin>,
        ),
      },
      {
        path: "*",
        element: withSuspense(
          <div className="py-20 text-center text-muted-foreground">Page not found.</div>,
        ),
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
