'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const error = searchParams.get('error');

  // If already logged in, redirect to feedback
  useEffect(() => {
    if (!loading && user) {
      router.push('/feedback');
    }
  }, [loading, user, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    }}>
      <div style={{
        width: 360,
        padding: 32,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #c8d8f0, #7aa2d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
        }}>
          Sevaro Hub
        </h1>
        <p style={{ color: '#5a6580', fontSize: '0.85rem', marginBottom: 24 }}>
          Sign in with your @sevaro.com account
        </p>

        {error && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
            fontSize: '0.82rem',
            marginBottom: 16,
          }}>
            {error === 'no_code' ? 'Authentication failed — no authorization code received.' :
             error === 'token_exchange' ? 'Authentication failed — could not exchange token.' :
             'Authentication failed. Please try again.'}
          </div>
        )}

        <a
          href="/api/auth/login"
          style={{
            display: 'block',
            width: '100%',
            padding: '12px 0',
            borderRadius: 8,
            background: '#7aa2d4',
            color: '#fff',
            fontSize: '0.9rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'background 0.15s',
            boxSizing: 'border-box',
          }}
        >
          Sign In
        </a>

        <p style={{ color: '#3a4560', fontSize: '0.75rem', marginTop: 16 }}>
          Restricted to @sevaro.com email addresses
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
