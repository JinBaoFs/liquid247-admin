import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post, SESSION_KEY, storedSession } from '../services/api';
import type { Session } from '../types';
interface AuthValue {
  session: Session | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthValue>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(storedSession);
  const [ready, setReady] = useState(false);
  const clear = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };
  const refresh = async () => {
    if (!storedSession()) {
      setReady(true);
      return;
    }
    try {
      const value = await api<Session>('auth/me');
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      setSession(value);
    } catch {
      clear();
    } finally {
      setReady(true);
    }
  };
  useEffect(() => {
    void refresh();
    const expire = () => clear();
    const storage = (e: StorageEvent) => {
      if (['liquid247:mock-db:v1', 'liquid247:mock-db:v2'].includes(e.key || '')) void refresh();
    };
    window.addEventListener('session-expired', expire);
    window.addEventListener('storage', storage);
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('session-expired', expire);
      window.removeEventListener('storage', storage);
    };
  }, []);
  const login = async (email: string, password: string) => {
    const value = await post<Session>('auth/login', { email, password });
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    setSession(value);
  };
  const logout = () => {
    void post('auth/logout').catch(() => {});
    clear();
  };
  return (
    <AuthContext.Provider value={{ session, ready, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
