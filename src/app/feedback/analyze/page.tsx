'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getIdToken } from '@/lib/auth';

interface Theme {
  name: string;
  description: string;
  frequency: number;
  severity: 'critical' | 'major' | 'minor';
  affectedApps: string[];
  relatedSessionIds: string[];
  recommendation: string;
}

interface AnalysisResult {
  themes: Theme[];
  summary: string;
  topPriority: string;
  sessionCount: number;
  analyzedDays: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
};

export default function AnalyzePage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/feedback/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ days }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Analysis failed: ${res.status}`);
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 1000,
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      background: '#0a0a0f',
      color: '#e0e0e8',
      minHeight: '100vh',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{
          fontSize: '1.8rem', fontWeight: 700,
          background: 'linear-gradient(135deg, #c8d8f0, #7aa2d4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Feedback Pattern Analysis
        </h1>
        <Link href="/feedback" style={{ color: '#7aa2d4', textDecoration: 'none', fontSize: '0.9rem' }}>
          &larr; Dashboard
        </Link>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 32, flexWrap: 'wrap',
      }}>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            padding: '8px 14px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
            color: '#e0e0e8', fontSize: '0.85rem', outline: 'none',
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: loading ? '#3a4560' : '#7aa2d4', color: '#fff',
            fontSize: '0.85rem', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze Recent Feedback'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: 16, borderRadius: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#5a6580' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: 8 }}>Analyzing feedback patterns with AI...</p>
          <p style={{ fontSize: '0.85rem' }}>This may take 10-15 seconds</p>
        </div>
      )}

      {result && (
        <>
          {/* Summary */}
          <div style={{
            background: 'rgba(122,162,212,0.05)', border: '1px solid rgba(122,162,212,0.15)',
            borderRadius: 12, padding: '18px 20px', marginBottom: 24,
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7aa2d4', marginBottom: 8 }}>
              Summary ({result.sessionCount} sessions, last {result.analyzedDays} days)
            </div>
            <p style={{ color: '#c0c8d8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 12 }}>{result.summary}</p>
            {result.topPriority && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f87171', textTransform: 'uppercase' }}>Top Priority: </span>
                <span style={{ color: '#d0d8e8', fontSize: '0.88rem' }}>{result.topPriority}</span>
              </div>
            )}
          </div>

          {/* Themes */}
          {result.themes.map((theme, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '18px 20px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                  padding: '2px 7px', borderRadius: 4,
                  background: `${SEVERITY_COLORS[theme.severity]}20`,
                  color: SEVERITY_COLORS[theme.severity],
                }}>
                  {theme.severity}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#5a6580' }}>
                  {theme.frequency} session{theme.frequency !== 1 ? 's' : ''}
                </span>
                {theme.affectedApps.map((app) => (
                  <span key={app} style={{
                    fontSize: '0.6rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(60,160,240,0.15)', color: '#60a5fa',
                  }}>
                    {app}
                  </span>
                ))}
              </div>
              <h3 style={{ color: '#d0d8e8', fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>
                {theme.name}
              </h3>
              <p style={{ color: '#8890a4', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 10 }}>
                {theme.description}
              </p>
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(34,197,94,0.05)', borderLeft: '3px solid #10b981',
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#4ade80', textTransform: 'uppercase' }}>Recommendation: </span>
                <span style={{ color: '#b0b8c8', fontSize: '0.85rem' }}>{theme.recommendation}</span>
              </div>
            </div>
          ))}

          {result.themes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#5a6580' }}>
              No significant patterns found in the selected time period.
            </div>
          )}
        </>
      )}
    </div>
  );
}
