'use client';
import { useState } from 'react';

export interface Theme {
  themeId: string;
  description: string;
  voteCount: number;
  statusBreakdown: { approved: number; open: number; rejected: number };
  weeklyTrend: number[];
  trending: boolean;
  newVotesSinceDenial: number;
  lastActivityAt: string;
}

export function ThemeCard({ theme }: { theme: Theme }) {
  const [expanded, setExpanded] = useState(false);
  const isResurfacing = theme.newVotesSinceDenial > 0;
  const total =
    theme.statusBreakdown.approved +
    theme.statusBreakdown.open +
    theme.statusBreakdown.rejected;

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${isResurfacing ? '#fecaca' : '#dedede'}`,
        boxShadow: isResurfacing ? '0 0 0 2px #fecaca40' : 'none',
        borderRadius: 8,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 3,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                background: '#e2d6fe',
                color: '#421d95',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                fontWeight: 500,
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}
            >
              {theme.themeId}
            </span>
            {theme.trending && (
              <span
                style={{
                  background: '#bbf7d1',
                  color: '#14532b',
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                ↑ trending
              </span>
            )}
            {isResurfacing && (
              <span
                style={{
                  background: '#fecaca',
                  color: '#7f1d1d',
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                ⚠ {theme.newVotesSinceDenial} new votes since denial
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#0c0f14', fontWeight: 500 }}>
            {theme.description}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
            {theme.voteCount}
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#696a70',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            votes
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              height: 6,
              borderRadius: 3,
              overflow: 'hidden',
              background: '#f1f1f1',
            }}
          >
            <div
              style={{
                background: '#22c55e',
                width: `${(theme.statusBreakdown.approved / Math.max(1, total)) * 100}%`,
              }}
            />
            <div
              style={{
                background: '#eab308',
                width: `${(theme.statusBreakdown.open / Math.max(1, total)) * 100}%`,
              }}
            />
            <div
              style={{
                background: '#dedede',
                width: `${(theme.statusBreakdown.rejected / Math.max(1, total)) * 100}%`,
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              fontSize: 10,
              color: '#696a70',
              marginTop: 3,
            }}
          >
            <span>✓ {theme.statusBreakdown.approved}</span>
            <span>○ {theme.statusBreakdown.open}</span>
            <span>✗ {theme.statusBreakdown.rejected}</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            height: 24,
          }}
        >
          {theme.weeklyTrend.map((count, i) => {
            const max = Math.max(...theme.weeklyTrend, 1);
            return (
              <div
                key={i}
                style={{
                  width: 4,
                  height: `${(count / max) * 100}%`,
                  background: '#54565c',
                  borderRadius: 1,
                }}
              />
            );
          })}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: 11,
            color: '#3b82f6',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Collapse ↑' : 'Expand ↓'}
        </button>
      </div>
    </div>
  );
}
