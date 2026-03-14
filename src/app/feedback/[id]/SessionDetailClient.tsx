'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { FeedbackSession, FeedbackEvent, ActionItem } from '@/lib/feedback-api';
import { formatDuration, formatTimestamp } from '@/lib/feedback-api';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
  cosmetic: '#6b7280',
};

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  'ux-issue': 'UX Issue',
  'feature-request': 'Feature Request',
  'content-fix': 'Content Fix',
};

interface Props {
  session: FeedbackSession;
  events: FeedbackEvent[];
  actionItems: ActionItem[];
  audioUrl: string;
  claudePrompt: string | null;
}

export function SessionDetailClient({ session, events, actionItems, audioUrl, claudePrompt }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const seekTo = (offsetMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = offsetMs / 1000;
      audioRef.current.play();
    }
  };

  const copyPrompt = () => {
    if (claudePrompt) {
      navigator.clipboard.writeText(claudePrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const date = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <>
      <style>{`
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e8; min-height: 100vh; }
        .sd-container { max-width: 1000px; margin: 0 auto; padding: 32px 24px 80px; }
        .sd-back { color: #7aa2d4; text-decoration: none; font-size: 0.9rem; display: inline-block; margin-bottom: 20px; }
        .sd-back:hover { text-decoration: underline; }
        .sd-header { margin-bottom: 24px; }
        .sd-header h1 { font-size: 1.4rem; font-weight: 700; color: #d0d8e8; margin-bottom: 8px; }
        .sd-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .sd-badge { display: inline-block; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 4px; }
        .sd-meta { font-size: 0.82rem; color: #5a6580; display: flex; gap: 16px; flex-wrap: wrap; }

        .sd-summary { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; margin-bottom: 20px; }
        .sd-summary-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a6580; margin-bottom: 8px; }
        .sd-summary-text { font-size: 0.95rem; color: #c0c8d8; line-height: 1.6; }

        .sd-audio { margin-bottom: 20px; }
        .sd-audio audio { width: 100%; border-radius: 8px; }

        .sd-section { margin-bottom: 24px; }
        .sd-section-title { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a6580; margin-bottom: 12px; }

        .sd-transcript { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px; font-size: 0.92rem; color: #b0b8c8; line-height: 1.7; white-space: pre-wrap; }

        .sd-timeline { display: flex; flex-direction: column; gap: 6px; }
        .sd-event { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: all 0.15s; }
        .sd-event:hover { background: rgba(255,255,255,0.05); border-color: rgba(120,160,220,0.2); }
        .sd-event-time { font-size: 0.78rem; font-family: monospace; color: #7aa2d4; min-width: 40px; padding-top: 1px; }
        .sd-event-type { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; }
        .sd-event-detail { font-size: 0.82rem; color: #8890a4; flex: 1; }

        .sd-actions { display: flex; flex-direction: column; gap: 10px; }
        .sd-action { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px 18px; }
        .sd-action-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
        .sd-action-title { font-size: 0.95rem; font-weight: 600; color: #d0d8e8; }
        .sd-action-desc { font-size: 0.85rem; color: #8890a4; line-height: 1.5; margin-bottom: 8px; }
        .sd-action-quotes { font-size: 0.82rem; color: #7aa2d4; font-style: italic; }
        .sd-action-pages { font-size: 0.78rem; color: #5a6580; margin-top: 4px; }

        .sd-prompt-section { margin-top: 32px; }
        .sd-prompt-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 8px; border: 1px solid rgba(120,160,220,0.3); background: rgba(120,160,220,0.1); color: #7aa2d4; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .sd-prompt-btn:hover { background: rgba(120,160,220,0.2); }
        .sd-prompt-box { margin-top: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.82rem; color: #b0b8c8; white-space: pre-wrap; line-height: 1.6; max-height: 400px; overflow-y: auto; }
        .sd-copy-btn { margin-top: 8px; padding: 8px 16px; border-radius: 6px; border: none; background: #0d9488; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .sd-copy-btn:hover { background: #0f766e; }

        @media (max-width: 600px) { .sd-meta { flex-direction: column; gap: 4px; } }
      `}</style>

      <div className="sd-container">
        <Link href="/feedback" className="sd-back">&larr; All Sessions</Link>

        {/* Header */}
        <div className="sd-header">
          <div className="sd-badges">
            <span className="sd-badge" style={{ background: 'rgba(60,160,240,0.15)', color: '#60a5fa' }}>{session.appId}</span>
            <span className="sd-badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>{session.category}</span>
            <span className="sd-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>{session.status}</span>
          </div>
          <h1>Feedback from {session.userLabel || 'Anonymous'}</h1>
          <div className="sd-meta">
            <span>{date}</span>
            <span>{formatDuration(session.duration || 0)}</span>
            <span>{session.screenSize || 'Unknown screen'}</span>
            <span>{(Array.isArray(session.events) ? session.events : []).length} events</span>
          </div>
        </div>

        {/* AI Summary */}
        {session.aiSummary && (
          <div className="sd-summary">
            <div className="sd-summary-label">AI Summary</div>
            <div className="sd-summary-text">{session.aiSummary}</div>
          </div>
        )}

        {/* Audio Player */}
        <div className="sd-audio">
          <audio ref={audioRef} controls preload="metadata" src={audioUrl} />
        </div>

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="sd-section">
            <div className="sd-section-title">Action Items ({actionItems.length})</div>
            <div className="sd-actions">
              {actionItems.map((item) => (
                <div key={item.id} className="sd-action">
                  <div className="sd-action-header">
                    <span className="sd-badge" style={{ background: `${SEVERITY_COLORS[item.severity]}20`, color: SEVERITY_COLORS[item.severity] }}>
                      {item.severity}
                    </span>
                    <span className="sd-badge" style={{ background: 'rgba(160,120,240,0.15)', color: '#b89afc' }}>
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                    <span className="sd-action-title">{item.title}</span>
                  </div>
                  <div className="sd-action-desc">{item.description}</div>
                  {item.userQuotes.length > 0 && (
                    <div className="sd-action-quotes">
                      {item.userQuotes.map((q, i) => (
                        <div key={i}>&ldquo;{q}&rdquo;</div>
                      ))}
                    </div>
                  )}
                  {item.affectedPages.length > 0 && (
                    <div className="sd-action-pages">Pages: {item.affectedPages.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Timeline */}
        {events.length > 0 && (
          <div className="sd-section">
            <div className="sd-section-title">Event Timeline</div>
            <div className="sd-timeline">
              {events.map((event, i) => {
                const typeColors: Record<string, { bg: string; text: string }> = {
                  route: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
                  click: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
                  scroll: { bg: 'rgba(160,160,180,0.15)', text: '#9ca3af' },
                  custom: { bg: 'rgba(160,120,240,0.15)', text: '#b89afc' },
                  screenshot: { bg: 'rgba(236,72,153,0.15)', text: '#f472b6' },
                };
                const tc = typeColors[event.type] || typeColors.custom;
                const detail =
                  event.type === 'route' ? `Navigated to ${(event.data as Record<string, string>).path}` :
                  event.type === 'click' ? `Clicked: ${(event.data as Record<string, string>).text || (event.data as Record<string, string>).selector}` :
                  event.type === 'scroll' ? `Scrolled to ${(event.data as Record<string, number>).percent}%${(event.data as Record<string, string>).section ? ` (${(event.data as Record<string, string>).section})` : ''}` :
                  JSON.stringify(event.data);

                return (
                  <div key={i} className="sd-event" onClick={() => seekTo(event.offsetMs)}>
                    <span className="sd-event-time">{formatTimestamp(event.offsetMs)}</span>
                    <span className="sd-event-type" style={{ background: tc.bg, color: tc.text }}>{event.type}</span>
                    <span className="sd-event-detail">{detail}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transcript */}
        {session.transcript && (
          <div className="sd-section">
            <div className="sd-section-title">Full Transcript</div>
            <div className="sd-transcript">{session.transcript}</div>
          </div>
        )}

        {/* Claude Code Prompt Generator */}
        {claudePrompt && (
          <div className="sd-prompt-section">
            <div className="sd-section-title">Claude Code Prompt</div>
            <button className="sd-prompt-btn" onClick={() => setShowPrompt(!showPrompt)}>
              {showPrompt ? 'Hide' : 'Show'} Generated Prompt
            </button>
            {showPrompt && (
              <>
                <div className="sd-prompt-box">{claudePrompt}</div>
                <button className="sd-copy-btn" onClick={copyPrompt}>
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
