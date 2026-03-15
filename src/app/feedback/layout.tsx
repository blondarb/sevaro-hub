'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#5a6580' }}>
        Loading...
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        color: '#8890a4',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}>
        <h2 style={{ color: '#d0d8e8', marginBottom: 8 }}>Admin Access Required</h2>
        <p>You need admin privileges to view the feedback dashboard.</p>
        <p style={{ fontSize: '0.82rem', color: '#5a6580', marginTop: 4 }}>
          Signed in as {user.email}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
