import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Admin access is required for this page.
      </div>
    );
  }
  return <>{children}</>;
}
