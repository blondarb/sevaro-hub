'use client';
import { useState } from 'react';
import type { FeedbackSession, TriageProposal } from '@/lib/feedback-api';

interface ProposalDetailProps {
  session: FeedbackSession;
  onApprove: (notes?: string) => void;
  onRejectClick: () => void;
  onRefine: (instruction: string) => Promise<void>;
}

const classificationColors: Record<TriageProposal['classification'], { bg: string; fg: string }> = {
  real_bug: { bg: '#bbf7d1', fg: '#14532b' },
  confused_user: { bg: '#fef3c7', fg: '#78350f' },
  duplicate: { bg: '#e5e7eb', fg: '#374151' },
  out_of_scope: { bg: '#e5e7eb', fg: '#374151' },
  needs_info: { bg: '#fef3c7', fg: '#78350f' },
};

function renderPromptWithOptionalDiff(
  current: string,
  previous: string | null,
  showDiff: boolean,
): React.ReactNode {
  if (!showDiff || !previous) {
    return current;
  }
  const previousLines = new Set(
    previous.split('\n').map((line) => line.trim()).filter(Boolean),
  );
  const currentLines = current.split('\n');
  return (
    <>
      {currentLines.map((line, idx) => {
        const isNew = line.trim() && !previousLines.has(line.trim());
        if (isNew) {
          return (
            <div
              key={idx}
              style={{ background: '#14532b', color: '#bbf7d1', padding: '2px 6px' }}
            >
              + {line}
            </div>
          );
        }
        return <div key={idx}>{line}</div>;
      })}
    </>
  );
}

export function ProposalDetail({
  session,
  onApprove,
  onRejectClick,
  onRefine,
}: ProposalDetailProps) {
  const proposal = session.triageProposal;
  const [refining, setRefining] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [showDiff, setShowDiff] = useState(false);

  if (!proposal) {
    return (
      <div style={{ padding: 24, color: '#696a70', fontSize: 13 }}>
        No proposal for this session.
      </div>
    );
  }

  const confidencePct = Math.round(proposal.confidence * 100);
  const lowConfidence = proposal.confidence < 0.6;
  const classificationLabel = proposal.classification.replace(/_/g, ' ');
  const classificationColor = classificationColors[proposal.classification] || {
    bg: '#e5e7eb',
    fg: '#374151',
  };
  const currentRevision = proposal.revisions[proposal.revisions.length - 1];
  const previousRevision =
    proposal.revisions.length >= 2
      ? proposal.revisions[proposal.revisions.length - 2]
      : null;
  const currentPrompt = currentRevision?.prompt || '';
  const previousPrompt = previousRevision?.prompt || null;

  const handleRefineSubmit = async () => {
    if (!instruction.trim()) return;
    setRefining(true);
    try {
      await onRefine(instruction.trim());
      setInstruction('');
    } finally {
      setRefining(false);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif",
        color: '#0c0f14',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {/* Header: session id, classification chip, confidence */}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${lowConfidence ? '#fecaca' : '#dedede'}`,
          boxShadow: lowConfidence ? '0 0 0 2px #fecaca40' : 'none',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            #{session.sessionId.slice(0, 6)} · {session.appId}
          </div>
          {proposal.revisions.length > 1 && (
            <div
              style={{
                fontSize: 11,
                color: '#696a70',
                background: '#f4f4f4',
                padding: '3px 8px',
                borderRadius: 10,
              }}
            >
              revision {currentRevision.version} of {proposal.revisions.length}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              background: classificationColor.bg,
              color: classificationColor.fg,
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {classificationLabel}
          </span>
          <span style={{ fontSize: 12, color: '#54565c' }}>
            Confidence: {confidencePct}%
          </span>
          {lowConfidence && (
            <span
              style={{
                background: '#fecaca',
                color: '#7f1d1d',
                padding: '3px 8px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              ⚠ low confidence
            </span>
          )}
          <a
            href={`/feedback/analyze?theme=${encodeURIComponent(proposal.themeId)}`}
            style={{
              background: '#e2d6fe',
              color: '#421d95',
              padding: '3px 10px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {proposal.themeId}
          </a>
        </div>
      </div>

      {/* Theme description & rationale */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #dedede',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#696a70',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          Theme
        </div>
        <div style={{ fontSize: 13, color: '#0c0f14', marginBottom: 14 }}>
          {proposal.themeDescription}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#696a70',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          Rationale
        </div>
        <div style={{ fontSize: 13, color: '#54565c', lineHeight: 1.5 }}>
          {proposal.rationale}
        </div>
      </div>

      {/* Suspected files */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #dedede',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#696a70',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Suspected code
          </div>
          {proposal.suspectedRepo && (
            <div style={{ fontSize: 11, color: '#696a70' }}>
              repo: <code>{proposal.suspectedRepo}</code>
            </div>
          )}
        </div>
        {proposal.suspectedFiles.length === 0 ? (
          <div style={{ fontSize: 12, color: '#696a70' }}>
            No files identified.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {proposal.suspectedFiles.map((file, idx) => (
              <div
                key={idx}
                style={{
                  borderLeft: '3px solid #dedede',
                  paddingLeft: 10,
                  fontSize: 12,
                }}
              >
                <div style={{ color: '#0c0f14', fontWeight: 600 }}>
                  {file.path}
                  <span style={{ color: '#696a70', fontWeight: 400 }}>
                    :{file.line}
                  </span>
                </div>
                {file.excerpt && (
                  <pre
                    style={{
                      background: '#f4f4f4',
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      color: '#0c0f14',
                      overflow: 'auto',
                      marginTop: 4,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {file.excerpt}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current prompt */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #dedede',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#696a70',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Current prompt
          </div>
          {previousPrompt && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              style={{
                background: '#fff',
                border: '1px solid #dedede',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                color: '#54565c',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {showDiff ? 'Hide diff' : 'Show diff from previous'}
            </button>
          )}
        </div>
        <pre
          style={{
            background: '#0c0f14',
            color: '#dedede',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {renderPromptWithOptionalDiff(currentPrompt, previousPrompt, showDiff)}
        </pre>
      </div>

      {/* Refine panel */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #dedede',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#696a70',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          Refine prompt
        </div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Include Tailwind classes and explain what pixel size to bump to"
          rows={3}
          style={{
            width: '100%',
            border: '1px solid #dedede',
            borderRadius: 6,
            padding: 10,
            fontSize: 12,
            fontFamily: 'inherit',
            color: '#0c0f14',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={handleRefineSubmit}
            disabled={refining || !instruction.trim()}
            style={{
              background: '#0c0f14',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 12,
              cursor: refining || !instruction.trim() ? 'not-allowed' : 'pointer',
              opacity: refining || !instruction.trim() ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {refining ? 'Rewriting…' : 'Rewrite ↵'}
          </button>
        </div>
      </div>

      {/* Action footer */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          paddingTop: 8,
        }}
      >
        <button
          onClick={onRejectClick}
          style={{
            background: '#fff',
            color: '#7f1d1d',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Reject
        </button>
        <button
          onClick={() => onApprove()}
          style={{
            background: '#14532b',
            color: '#bbf7d1',
            border: 'none',
            borderRadius: 6,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
