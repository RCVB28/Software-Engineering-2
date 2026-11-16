import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken
} from '../services/api';
import type { AuthToken, ResidentRole, UserSummary } from '../types';

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  loginAdmin: (email: string, password: string) => Promise<UserSummary>;
  loginResident: (
    idToken: string,
    profile?: { barangayId?: string; role?: ResidentRole; buildingTag?: string; displayName?: string }
  ) => Promise<UserSummary>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persist(auth: AuthToken): UserSummary {
  setToken(auth.accessToken);
  setStoredUser(auth.user);
  return auth.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(Boolean(getToken()));

  const logout = () => {
    setToken(null);
    setStoredUser(null);
    setUser(null);
  };

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const current = await api.auth.me();
      setStoredUser(current);
      setUser(current);
    } catch {
      logout();
    }
  };

  useEffect(() => {
    let active = true;
    refresh().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const loginAdmin = async (email: string, password: string) => {
    const auth = await api.auth.adminLogin(email, password);
    const summary = persist(auth);
    setUser(summary);
    return summary;
  };

  const loginResident = async (
    idToken: string,
    profile?: { barangayId?: string; role?: ResidentRole; buildingTag?: string; displayName?: string }
  ) => {
    const auth = await api.auth.residentGoogle(idToken, profile);
    const summary = persist(auth);
    setUser(summary);
    return summary;
  };

  const value = useMemo(
    () => ({ user, loading, loginAdmin, loginResident, logout, refresh }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
