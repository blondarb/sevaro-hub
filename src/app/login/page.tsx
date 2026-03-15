'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import type { CognitoUser } from 'amazon-cognito-identity-js';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, completeNewPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (needsNewPassword && cognitoUser) {
        const result = await completeNewPassword(cognitoUser, newPassword);
        if (result.error) {
          setError(result.error);
        } else {
          router.push('/feedback');
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        } else if (result.newPasswordRequired && result.cognitoUser) {
          setNeedsNewPassword(true);
          setCognitoUser(result.cognitoUser);
        } else {
          router.push('/feedback');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

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
      }}>
        <h1 style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #c8d8f0, #7aa2d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
          textAlign: 'center',
        }}>
          Sevaro Hub
        </h1>
        <p style={{ color: '#5a6580', fontSize: '0.85rem', textAlign: 'center', marginBottom: 24 }}>
          {needsNewPassword ? 'Set a new password to continue' : 'Sign in to manage feedback'}
        </p>

        <form onSubmit={handleSubmit}>
          {!needsNewPassword ? (
            <>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </>
          ) : (
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          )}

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
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#3a4560' : '#7aa2d4',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Signing in...' : needsNewPassword ? 'Set Password' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e0e0e8',
  fontSize: '0.9rem',
  marginBottom: 12,
  outline: 'none',
  boxSizing: 'border-box',
};
