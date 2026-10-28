import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import { Card } from "./ui/card";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando sessão…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function PermissionGate({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <Card className="items-center gap-2 px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-critical-surface text-critical">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <p className="text-base font-bold text-gov-blue-dark">
          Acesso restrito
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua conta não possui a permissão{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {permission}
          </code>
          .
        </p>
      </Card>
    );
  }

  return <>{children}</>;
}
