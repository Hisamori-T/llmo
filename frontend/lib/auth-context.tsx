'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { apiClient } from './api';
import type { User } from './types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await fetchUser();
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) {
      try { await apiClient.post('/auth/logout', { session_id: sessionId }); } catch {}
      localStorage.removeItem('session_id');
    }
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
    await signOut(auth);
    setUser(null);
  };

  const refreshUser = async () => {
    if (firebaseUser) await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
