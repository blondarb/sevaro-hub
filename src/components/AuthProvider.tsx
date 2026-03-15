'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { AuthUser } from '@/lib/auth';
import type { CognitoUser } from 'amazon-cognito-identity-js';

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; newPasswordRequired?: boolean; cognitoUser?: CognitoUser }>;
  completeNewPassword: (cognitoUser: CognitoUser, newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: 'Not initialized' }),
  completeNewPassword: async () => ({ error: 'Not initialized' }),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.isAdmin);
      }
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { getCurrentUser, getIdToken } = await import('@/lib/auth');
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const token = await getIdToken();
        if (token) await checkAdmin(token);
      } else {
        setIsAdmin(false);
      }
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [checkAdmin]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const { signIn } = await import('@/lib/auth');
    const result = await signIn(email, password);
    if (!result.error && !result.newPasswordRequired) {
      await refreshUser();
    }
    return result;
  }, [refreshUser]);

  const handleCompleteNewPassword = useCallback(async (cognitoUser: CognitoUser, newPassword: string) => {
    const { completeNewPassword } = await import('@/lib/auth');
    const result = await completeNewPassword(cognitoUser, newPassword);
    if (!result.error) {
      await refreshUser();
    }
    return result;
  }, [refreshUser]);

  const handleSignOut = useCallback(async () => {
    const { signOut } = await import('@/lib/auth');
    await signOut();
    setUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      loading,
      signIn: handleSignIn,
      completeNewPassword: handleCompleteNewPassword,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
