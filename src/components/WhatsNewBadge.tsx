'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WhatsNewEntry } from '@/lib/whats-new-api';

const API_URL =
  process.env.NEXT_PUBLIC_WHATS_NEW_API_URL ||
  'https://5168ofhh8k.execute-api.us-east-2.amazonaws.com';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  fix: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Fix' },
  feature: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: 'Feature' },
  improvement: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Improvement' },
};

interface Props {
  appId: string;
}

export function WhatsNewBadge({ appId }: Props) {
  const [updates, setUpdates] = useState<WhatsNewEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  const storageKey = `whats-new-last-seen-${appId}`;

  const fetchUpdates = useCallback(async () => {
    try {
      // Check cache
      const cacheKey = `whats-new-cache-${appId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setUpdates(data);
          updateUnseenCount(data);
          return;
        }
      }

      const params = new URLSearchParams({ appId });
      const res = await fetch(`${API_URL}/whats-new?${params}`);
      if (!res.ok) return;
      const { updates: data } = await res.json();
      setUpdates(data || []);
      updateUnseenCount(data || []);

      // Cache
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    } catch {
      // Silently fail — badge just won't show
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  function updateUnseenCount(items: WhatsNewEntry[]) {
    const lastSeen = localStorage.getItem(storageKey);
    lastSeenRef.current = lastSeen;
    if (!lastSeen) {
      setUnseenCount(items.length);
      return;
    }
    const count = items.filter((u) => u.timestamp > lastSeen).length;
    setUnseenCount(count);
  }

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function markAllRead() {
    if (updates.length > 0) {
      localStorage.setItem(storageKey, updates[0].timestamp);
      lastSeenRef.current = updates[0].timestamp;
      setUnseenCount(0);
    }
  }

  function handleToggle() {
    setOpen((prev) => !prev);
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={handleToggle}
        aria-label={`What's new: ${unseenCount} unseen updates`}
        style={{
          position: 'relative',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          color: '#8890a4',
          fontSize: '0.78rem',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ fontSize: '0.9rem' }}>&#9672;</span>
        <span>What&apos;s New</span>
        {unseenCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.6rem',
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxHeight: 420,
            overflowY: 'auto',
            background: 'rgba(16,16,24,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            zIndex: 200,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#d0d8e8' }}>
              What&apos;s New
            </span>
            {unseenCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#7aa2d4',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {updates.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#5a6580', fontSize: '0.85rem' }}>
              No updates yet
            </div>
          ) : (
            updates.map((entry) => {
              const isNew = !lastSeenRef.current || entry.timestamp > lastSeenRef.current;
              const cat = CATEGORY_STYLES[entry.category] || CATEGORY_STYLES.improvement;
              const date = new Date(entry.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={`${entry.appId}-${entry.timestamp}`}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isNew ? 'rgba(122,162,212,0.04)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {isNew && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#7aa2d4',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: cat.bg,
                        color: cat.text,
                      }}
                    >
                      {cat.label}
                    </span>
                    {entry.appId !== appId && entry.appId !== 'all' && (
                      <span style={{ fontSize: '0.6rem', color: '#5a6580' }}>{entry.appId}</span>
                    )}
                    <span style={{ fontSize: '0.7rem', color: '#5a6580', marginLeft: 'auto' }}>
                      {date}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d0d8e8', marginBottom: 2 }}>
                    {entry.link ? (
                      <a
                        href={entry.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#d0d8e8', textDecoration: 'none' }}
                      >
                        {entry.title}
                      </a>
                    ) : (
                      entry.title
                    )}
                    {entry.version && (
                      <span style={{ fontSize: '0.7rem', color: '#5a6580', marginLeft: 6 }}>
                        v{entry.version}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#8890a4', lineHeight: 1.4 }}>
                    {entry.description}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
