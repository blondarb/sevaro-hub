'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { AuthUser } from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  loading: true,
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      // Check auth session via cookie-based API
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        setUser(null);
        setIsAdmin(false);
        return;
      }
      const userData = await res.json();
      setUser(userData);

      // Check admin status
      const tokenRes = await fetch('/api/auth/token');
      if (tokenRes.ok) {
        const { idToken } = await tokenRes.json();
        if (idToken) {
          const adminRes = await fetch('/api/admin/check', {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            setIsAdmin(adminData.isAdmin);
          }
        }
      }
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const handleSignOut = useCallback(() => {
    // Redirect to OAuth logout endpoint (clears cookies + Cognito session)
    window.location.href = '/api/auth/logout';
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      loading,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
