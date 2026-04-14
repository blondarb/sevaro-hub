'use client';
import { useState } from 'react';
import type { FeedbackSession } from '@/lib/feedback-api';

export function TriageClient({ initialSessions }: { initialSessions: FeedbackSession[] }) {
  const [sessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.sessionId || null);
  const selected = sessions.find((s) => s.sessionId === selectedId);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif",
      }}
    >
      <div
        style={{
          flex: '0 0 340px',
          borderRight: '1px solid #dedede',
          overflowY: 'auto',
          background: '#fff',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #dedede',
            fontWeight: 600,
            fontSize: 14,
            color: '#0c0f14',
          }}
        >
          Triage Queue · {sessions.length}
        </div>
        {sessions.length === 0 && (
          <div style={{ padding: 24, color: '#696a70', fontSize: 13, lineHeight: 1.5 }}>
            No proposals yet. Run <code>/triage-feedback</code> locally to populate.
          </div>
        )}
        {sessions.map((s) => {
          const classification = s.triageProposal?.classification;
          const borderColor =
            classification === 'real_bug'
              ? '#22c55e'
              : classification === 'needs_info'
                ? '#eab308'
                : '#acacaf';
          const transcript = typeof s.transcript === 'string' ? s.transcript : '';
          return (
            <button
              key={s.sessionId}
              onClick={() => setSelectedId(s.sessionId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                border: 'none',
                background: selectedId === s.sessionId ? '#f4f4f4' : '#fff',
                borderLeft: `3px solid ${borderColor}`,
                cursor: 'pointer',
                borderBottom: '1px solid #f1f1f1',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0c0f14' }}>
                #{s.sessionId.slice(0, 6)} · {s.appId}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#696a70',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {transcript.slice(0, 80) || '(no transcript)'}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9f9f9' }}>
        {selected ? (
          <div style={{ padding: 24, color: '#54565c', fontSize: 13 }}>
            Detail pane for #{selected.sessionId.slice(0, 6)} — wired in Task 19
          </div>
        ) : (
          <div style={{ padding: 24, color: '#696a70', fontSize: 13 }}>
            Select a session from the list
          </div>
        )}
      </div>
    </div>
  );
}
