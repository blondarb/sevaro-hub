'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeedbackSession } from '@/lib/feedback-api';
import { ProposalDetail } from './ProposalDetail';
import { RejectModal, type RejectReason } from './RejectModal';

export function TriageClient({ initialSessions }: { initialSessions: FeedbackSession[] }) {
  const router = useRouter();
  const [sessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState<string | null>(
    sessions[0]?.sessionId || null,
  );
  const [rejectOpen, setRejectOpen] = useState(false);
  const [runningTriage, setRunningTriage] = useState(false);
  const selected = sessions.find((s) => s.sessionId === selectedId);
  const untriagedCount = sessions.filter((s) => !s.triageProposal).length;

  async function handleApprove(
    sessionId: string,
    appId: string,
    notes?: string,
  ) {
    try {
      const res = await fetch(
        `/api/feedback/${encodeURIComponent(sessionId)}/approve-proposal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, reviewerNotes: notes }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(`Approve failed: ${body.error || res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      alert(
        `Approve failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function handleReject(
    sessionId: string,
    appId: string,
    reason: RejectReason,
    comment?: string,
  ) {
    try {
      const res = await fetch(
        `/api/feedback/${encodeURIComponent(sessionId)}/proposal`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, reason, comment }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(`Reject failed: ${body.error || res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      alert(`Reject failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleRefine(
    sessionId: string,
    appId: string,
    instruction: string,
  ) {
    try {
      const res = await fetch(
        `/api/feedback/${encodeURIComponent(sessionId)}/refine-prompt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, instruction }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(`Refine failed: ${body.error || res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      alert(`Refine failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleRunTriage() {
    const untriaged = sessions.filter((s) => !s.triageProposal);
    if (untriaged.length === 0) return;
    setRunningTriage(true);
    try {
      const res = await fetch('/api/feedback/triage-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionIds: untriaged.map((s) => s.sessionId),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(`Run Triage failed: ${body.error || res.status}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        runCommand?: string;
      };
      alert(
        `Triage request queued.\n\nRun locally:\n${
          data.runCommand || '/triage-feedback'
        }`,
      );
      router.refresh();
    } catch (e) {
      alert(
        `Run Triage failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setRunningTriage(false);
    }
  }

  // Keyboard navigation: Up/Down to move through list, `a` to approve, `r` to reject
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if (sessions.length === 0) return;
      const currentIdx = sessions.findIndex((s) => s.sessionId === selectedId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(
          sessions.length - 1,
          currentIdx < 0 ? 0 : currentIdx + 1,
        );
        setSelectedId(sessions[next].sessionId);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(0, currentIdx < 0 ? 0 : currentIdx - 1);
        setSelectedId(sessions[prev].sessionId);
      } else if (e.key === 'a' || e.key === 'A') {
        if (selected && selected.triageProposal && !rejectOpen) {
          e.preventDefault();
          handleApprove(selected.sessionId, selected.appId);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (selected && selected.triageProposal && !rejectOpen) {
          e.preventDefault();
          setRejectOpen(true);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, selectedId, rejectOpen, selected]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif",
      }}
    >
      {/* Top toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid #dedede',
          background: '#fff',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0c0f14' }}>
          Triage Queue
        </div>
        <button
          onClick={handleRunTriage}
          disabled={runningTriage || untriagedCount === 0}
          style={{
            background:
              untriagedCount === 0 || runningTriage ? '#f4f4f4' : '#0c0f14',
            color:
              untriagedCount === 0 || runningTriage ? '#696a70' : '#fff',
            border:
              untriagedCount === 0 || runningTriage
                ? '1px solid #dedede'
                : 'none',
            borderRadius: 6,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor:
              untriagedCount === 0 || runningTriage ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {runningTriage
            ? 'Queuing…'
            : `⟳ Run Triage on these ${untriagedCount} now`}
        </button>
      </div>

      {/* List + detail row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
            Sessions · {sessions.length}
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
          {selected && selected.triageProposal ? (
            <ProposalDetail
              session={selected}
              onApprove={(notes) =>
                handleApprove(selected.sessionId, selected.appId, notes)
              }
              onRejectClick={() => setRejectOpen(true)}
              onRefine={async (instruction) =>
                handleRefine(selected.sessionId, selected.appId, instruction)
              }
            />
          ) : selected ? (
            <div style={{ padding: 24, color: '#696a70', fontSize: 13 }}>
              No proposal for #{selected.sessionId.slice(0, 6)}.
            </div>
          ) : (
            <div style={{ padding: 24, color: '#696a70', fontSize: 13 }}>
              Select a session from the list
            </div>
          )}
        </div>
      </div>

      {rejectOpen && selected && (
        <RejectModal
          onConfirm={(reason, comment) => {
            handleReject(selected.sessionId, selected.appId, reason, comment);
            setRejectOpen(false);
          }}
          onCancel={() => setRejectOpen(false)}
        />
      )}
    </div>
  );
}
