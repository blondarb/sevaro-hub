import { NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/verify-auth';
import { fetchTriageHistory, type TriageHistoryEntry } from '@/lib/triage-api';

type ThemeRollup = {
  themeId: string;
  description: string;
  voteCount: number;
  statusBreakdown: { approved: number; open: number; rejected: number };
  weeklyTrend: number[];
  trending: boolean;
  newVotesSinceDenial: number;
  lastActivityAt: string;
};

function rollup(entries: TriageHistoryEntry[]): ThemeRollup[] {
  const byTheme = new Map<string, TriageHistoryEntry[]>();
  for (const e of entries) {
    if (!e.themeId) continue;
    const list = byTheme.get(e.themeId) ?? [];
    list.push(e);
    byTheme.set(e.themeId, list);
  }

  const themes: ThemeRollup[] = [];
  const nowMs = Date.now();
  const bucketWidthMs = 7 * 24 * 60 * 60 * 1000; // 1 week per bucket

  for (const [themeId, list] of byTheme) {
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const desc =
      (list[0]?.proposalSnapshot as { themeDescription?: string } | undefined)
        ?.themeDescription || '';

    const buckets = [0, 0, 0, 0, 0, 0];
    let approved = 0;
    let open = 0;
    let rejected = 0;
    let lastRejectTs: string | null = null;

    for (const e of list) {
      if (e.action === 'proposed') {
        open += 1;
      } else if (e.action === 'approved') {
        approved += 1;
        open = Math.max(0, open - 1);
      } else if (e.action === 'rejected') {
        rejected += 1;
        open = Math.max(0, open - 1);
        lastRejectTs = e.timestamp;
      }

      const ageMs = nowMs - new Date(e.timestamp).getTime();
      const bucketIdx = 5 - Math.min(5, Math.floor(ageMs / bucketWidthMs));
      if (bucketIdx >= 0) buckets[bucketIdx] += 1;
    }

    const newVotesSinceDenial = lastRejectTs
      ? list.filter(
          (e) => e.action === 'proposed' && e.timestamp > lastRejectTs!,
        ).length
      : 0;

    const lastHalf = buckets[4] + buckets[5];
    const firstHalf = buckets[0] + buckets[1];
    const trending = lastHalf > firstHalf && lastHalf >= 2;

    themes.push({
      themeId,
      description: desc,
      voteCount: list.filter(
        (e) => e.action === 'proposed' || e.action === 'approved',
      ).length,
      statusBreakdown: { approved, open, rejected },
      weeklyTrend: buckets,
      trending,
      newVotesSinceDenial,
      lastActivityAt: list[list.length - 1].timestamp,
    });
  }

  return themes.sort((a, b) => b.voteCount - a.voteCount);
}

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin)
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get('days');
  const days = daysParam ? Number(daysParam) : 30;

  try {
    const data = await fetchTriageHistory(days);
    const themes = rollup(data.entries);
    const stats = {
      totalSessions: themes.reduce((s, t) => s + t.voteCount, 0),
      totalThemes: themes.length,
      trendingUp: themes.filter((t) => t.trending).length,
      newVotesSinceDenial: themes.filter((t) => t.newVotesSinceDenial > 0)
        .length,
      awaitingTriage: 0, // wired up by a separate call later
    };
    return NextResponse.json({
      timeRange: {
        from: new Date(Date.now() - days * 86400000).toISOString(),
        to: new Date().toISOString(),
      },
      stats,
      themes,
    });
  } catch (err) {
    console.error('Failed to roll up triage history:', err);
    return NextResponse.json(
      {
        error: 'Failed to load analysis',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
