import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { api, session } from "../api/client";
import type { LoginResponse, SessionUser } from "../api/types";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!session.access()) {
      setUser(null);
      return;
    }
    try {
      const current = await api<SessionUser>("/auth/me");
      setUser(current);
    } catch {
      session.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    session.save(response.access_token, response.refresh_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = session.refresh();
    try {
      if (refresh) {
        await api("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        });
      }
    } catch {
      // A sessão local é encerrada mesmo que a revogação falhe.
    } finally {
      session.clear();
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, reload, hasPermission }),
    [user, loading, login, logout, reload, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
