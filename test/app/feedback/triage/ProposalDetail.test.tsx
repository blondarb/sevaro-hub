// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProposalDetail } from '@/app/feedback/triage/ProposalDetail';
import type { FeedbackSession } from '@/lib/feedback-api';

const baseSession: FeedbackSession = {
  sessionId: 'a3f2abc',
  appId: 'evidence-engine',
  userId: undefined,
  category: 'bug report',
  startedAt: '2026-04-14T09:00:00Z',
  duration: 60,
  audioKey: '',
  screenshots: [],
  transcript: 'Dosing card text is tiny',
  events: [],
  status: 'processed',
  createdAt: '2026-04-14T09:00:00Z',
  triageProposal: {
    version: 1,
    createdAt: '2026-04-14T09:00:00Z',
    classification: 'real_bug',
    confidence: 0.92,
    themeId: 'fonts-too-small',
    themeDescription: 'Font too small on dosing cards',
    suspectedRepo: 'sevaro-evidence-engine',
    suspectedFiles: [{ path: 'components/DosingCard.tsx', line: 42, excerpt: '<span className="text-sm"...' }],
    rationale: 'User explicitly complained about readability',
    revisions: [{ version: 1, prompt: 'Bump font to 16px', instruction: null, createdAt: '2026-04-14T09:00:00Z' }],
  },
};

describe('ProposalDetail', () => {
  it('renders the classification, confidence, theme, rationale, and current prompt', () => {
    render(
      <ProposalDetail
        session={baseSession}
        onApprove={() => {}}
        onRejectClick={() => {}}
        onRefine={async () => {}}
      />,
    );
    expect(screen.getByText(/real bug/i)).toBeInTheDocument();
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(screen.getByText(/fonts-too-small/)).toBeInTheDocument();
    expect(screen.getByText(/Bump font to 16px/)).toBeInTheDocument();
    expect(screen.getByText(/components\/DosingCard\.tsx/)).toBeInTheDocument();
  });

  it('shows "revision N of M" when revisions count > 1', () => {
    const multi = {
      ...baseSession,
      triageProposal: {
        ...baseSession.triageProposal!,
        revisions: [
          { version: 1, prompt: 'v1', instruction: null, createdAt: '2026-04-14T09:00:00Z' },
          { version: 2, prompt: 'v2', instruction: 'also check contrast', createdAt: '2026-04-14T09:05:00Z' },
        ],
      },
    };
    render(
      <ProposalDetail
        session={multi}
        onApprove={() => {}}
        onRejectClick={() => {}}
        onRefine={async () => {}}
      />,
    );
    expect(screen.getByText(/revision 2 of 2/i)).toBeInTheDocument();
  });

  it('shows a low-confidence warning chip when confidence < 0.6', () => {
    const low = {
      ...baseSession,
      triageProposal: { ...baseSession.triageProposal!, confidence: 0.42 },
    };
    render(
      <ProposalDetail
        session={low}
        onApprove={() => {}}
        onRejectClick={() => {}}
        onRefine={async () => {}}
      />,
    );
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
  });

  it('calls onRejectClick when the Reject button is clicked', async () => {
    const onRejectClick = vi.fn();
    render(
      <ProposalDetail
        session={baseSession}
        onApprove={() => {}}
        onRejectClick={onRejectClick}
        onRefine={async () => {}}
      />,
    );
    const user = await import('@testing-library/react').then((m) => m);
    const button = screen.getByRole('button', { name: /reject/i });
    button.click();
    expect(onRejectClick).toHaveBeenCalled();
  });
});
