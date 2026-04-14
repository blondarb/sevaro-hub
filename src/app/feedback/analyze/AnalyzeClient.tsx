'use client';
import { useEffect, useState } from 'react';
import { ThemeCard, type Theme } from './ThemeCard';

interface AnalyzeResponse {
  timeRange: { from: string; to: string };
  stats: {
    totalSessions: number;
    totalThemes: number;
    trendingUp: number;
    newVotesSinceDenial: number;
    awaitingTriage: number;
  };
  themes: Theme[];
}

type SortKey = 'votes' | 'trending' | 'recent' | 'resurfacing';

export function AnalyzeClient() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<SortKey>('votes');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    fetch(`/api/feedback/analyze?days=${days}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as {
            error?: string;
            details?: string;
          };
          const parts = [body.error || `Failed to load (${r.status})`];
          if (body.details && body.details !== body.error)
            parts.push(body.details);
          throw new Error(parts.join(' — '));
        }
        return r.json() as Promise<AnalyzeResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error) {
    return (
      <div style={{ padding: 24, color: '#7f1d1d', fontFamily: '-apple-system, sans-serif' }}>
        Error: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 24, fontFamily: '-apple-system, sans-serif' }}>
        Loading…
      </div>
    );
  }

  const sorted = [...data.themes].sort((a, b) => {
    if (sort === 'votes') return b.voteCount - a.voteCount;
    if (sort === 'trending') return Number(b.trending) - Number(a.trending);
    if (sort === 'recent') return b.lastActivityAt.localeCompare(a.lastActivityAt);
    if (sort === 'resurfacing')
      return b.newVotesSinceDenial - a.newVotesSinceDenial;
    return 0;
  });

  const selectStyle: React.CSSProperties = {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #dedede',
    background: '#fff',
    color: '#0c0f14',
    fontFamily: 'inherit',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        fontFamily: '-apple-system, sans-serif',
        background: '#f9f9f9',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #dedede',
          padding: '18px 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 600 }}>Themes & Patterns</div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#696a70',
            }}
          >
            <span>Time range:</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={selectStyle}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Stat label="Sessions" value={data.stats.totalSessions} />
          <Stat label="Themes" value={data.stats.totalThemes} />
          <Stat label="Trending up" value={data.stats.trendingUp} color="#14532b" />
          <Stat
            label="New votes since denial"
            value={data.stats.newVotesSinceDenial}
            color="#7f1d1d"
          />
          {/* TODO(Phase 4 Task 18): link to /feedback/triage once that route exists. */}
          <Stat
            label="Awaiting triage"
            value={`${data.stats.awaitingTriage}`}
            color="#1e478a"
          />
        </div>
      </div>
      <div style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['votes', 'trending', 'recent', 'resurfacing'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                background: sort === s ? '#0c0f14' : '#fff',
                color: sort === s ? '#fff' : '#54565c',
                border: '1px solid #dedede',
                fontSize: 11,
                padding: '5px 12px',
                borderRadius: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {s === 'votes'
                ? 'Most votes'
                : s === 'trending'
                  ? 'Trending'
                  : s === 'recent'
                    ? 'Most recent'
                    : 'Re-surfacing'}
            </button>
          ))}
        </div>
        {sorted.map((t) => (
          <ThemeCard key={t.themeId} theme={t} />
        ))}
        {sorted.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#696a70',
            }}
          >
            No themes yet. Run /triage-feedback to populate.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: '#696a70',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || '#0c0f14' }}>
        {value}
      </div>
    </div>
  );
}
