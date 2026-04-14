'use client';
import { useState } from 'react';

export type RejectReason =
  | 'not_a_real_issue'
  | 'already_fixed'
  | 'low_priority'
  | 'duplicate'
  | 'out_of_scope'
  | 'need_more_info';

interface RejectModalProps {
  onConfirm: (reason: RejectReason, comment?: string) => void;
  onCancel: () => void;
}

const REASONS: Array<{ id: RejectReason; label: string }> = [
  { id: 'not_a_real_issue', label: 'Not a real issue' },
  { id: 'already_fixed', label: 'Already fixed' },
  { id: 'low_priority', label: 'Low priority — defer' },
  { id: 'duplicate', label: 'Duplicate of existing item' },
  { id: 'out_of_scope', label: 'Out of scope' },
  { id: 'need_more_info', label: 'Need more info from reporter' },
];

export function RejectModal({ onConfirm, onCancel }: RejectModalProps) {
  const [reason, setReason] = useState<RejectReason>('not_a_real_issue');
  const [comment, setComment] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif",
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 24,
          width: 440,
          maxWidth: '90vw',
          color: '#0c0f14',
          boxShadow: '0 20px 48px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Reject proposal
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {REASONS.map((r) => (
            <label
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: '#0c0f14',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="reject-reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
              />
              {r.label}
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
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
            Comment (optional)
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
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
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              background: '#fff',
              color: '#54565c',
              border: '1px solid #dedede',
              borderRadius: 6,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason, comment.trim() || undefined)}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Confirm reject
          </button>
        </div>
      </div>
    </div>
  );
}
