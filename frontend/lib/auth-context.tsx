'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import { apiClient, setAccessToken } from './api';
import type { User } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://llmo.fact-ally.com/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setTokens: (access_token: string, session_id: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
  setTokens: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await apiClient.get('/users/me');
      const d = res.data;
      setUser({
        uid: d.user_id,
        email: d.email,
        displayName: d.display_name,
        plan: d.plan ?? 'starter',
        orgId: d.agency_id,
        role: d.role,
        monthlyCreditsUsed: d.monthly_credit_used ?? 0,
        monthlyCreditsLimit: d.monthly_credit_limit ?? 0,
        createdAt: d.created_at ?? '',
      });
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    // Bootstrap access token from httpOnly refresh cookie on every page load
    axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.access_token);
        return fetchUser();
      })
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setTokens = (access_token: string, session_id: string) => {
    setAccessToken(access_token);
    if (typeof window !== 'undefined') localStorage.setItem('session_id', session_id);
  };

  const logout = async () => {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('session_id') : null;
    if (sessionId) {
      try { await apiClient.post('/auth/logout', { session_id: sessionId }); } catch {}
    }
    setAccessToken(null);
    if (typeof window !== 'undefined') localStorage.removeItem('session_id');
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser, setTokens }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
