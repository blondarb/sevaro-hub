'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { WhatsNewBadge } from './WhatsNewBadge';

export function NavBar() {
  const { user, isAdmin, loading, signOut } = useAuth();

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 24px',
      background: 'rgba(10,10,15,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link href="/" style={{ color: '#7aa2d4', textDecoration: 'none', fontWeight: 700, fontSize: '0.95rem' }}>
          Sevaro Hub
        </Link>
        {isAdmin && (
          <>
            <Link href="/feedback" style={linkStyle}>Feedback</Link>
            <Link href="/feedback/analyze" style={linkStyle}>Analyze</Link>
            <Link href="/admin/whats-new" style={linkStyle}>What&apos;s New</Link>
            <Link href="/admin/improvements" style={linkStyle}>Improvements</Link>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <WhatsNewBadge appId="sevaro-hub" />
        {loading ? null : user ? (
          <>
            <span style={{ color: '#5a6580', fontSize: '0.8rem' }}>{user.email}</span>
            {isAdmin && (
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(122,162,212,0.15)',
                color: '#7aa2d4',
              }}>
                Admin
              </span>
            )}
            <button
              onClick={signOut}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#8890a4',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link href="/login" style={{
            padding: '4px 14px',
            borderRadius: 6,
            border: '1px solid rgba(122,162,212,0.3)',
            background: 'rgba(122,162,212,0.1)',
            color: '#7aa2d4',
            fontSize: '0.82rem',
            textDecoration: 'none',
            fontWeight: 500,
          }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

const linkStyle: React.CSSProperties = {
  color: '#8890a4',
  textDecoration: 'none',
  fontSize: '0.82rem',
  fontWeight: 500,
};
