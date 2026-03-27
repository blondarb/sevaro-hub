import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { listSessions } from '@/lib/feedback-api';

const bedrock = new BedrockRuntimeClient({ region: 'us-east-2' });

export async function POST(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const body = await request.json();
  const days = body.days || 30;
  const appId: string | undefined = body.appId; // undefined = cross-app mode

  try {
    const sessions = await listSessions();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let unresolvedSessions = sessions.filter((s) => {
      const isRecent = s.createdAt >= cutoff;
      const isUnresolved = !s.reviewStatus || s.reviewStatus === 'open' || s.reviewStatus === 'in_progress';
      return isRecent && isUnresolved;
    });

    // Filter by app if scoped
    if (appId) {
      unresolvedSessions = unresolvedSessions.filter((s) => s.appId === appId);
    }

    if (unresolvedSessions.length === 0) {
      return NextResponse.json({
        themes: [],
        summary: appId
          ? `No unresolved feedback sessions for ${appId} in the last ${days} days.`
          : `No unresolved feedback sessions found in the last ${days} days.`,
        topPriority: '',
        sessionCount: 0,
        analyzedDays: days,
      });
    }

    const sessionSummaries = unresolvedSessions.map((s) => {
      const actionItems = Array.isArray(s.actionItems) ? s.actionItems : [];
      return {
        sessionId: s.sessionId,
        app: s.appId,
        category: s.category,
        date: s.createdAt,
        user: s.userLabel || 'Anonymous',
        summary: s.aiSummary || s.transcript?.slice(0, 300) || 'No summary',
        actionItems: actionItems.map((a) => ({
          type: a.type,
          title: a.title,
          description: a.description,
          severity: a.severity,
          pages: a.affectedPages,
        })),
      };
    });

    const prompt = appId
      ? buildPerAppPrompt(sessionSummaries, days, appId)
      : buildCrossAppPrompt(sessionSummaries, days);

    const converseResponse = await bedrock.send(new ConverseCommand({
      modelId: 'us.anthropic.claude-sonnet-4-6',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 2000, temperature: 0.2 },
    }));

    const responseText = converseResponse.output?.message?.content?.[0]?.text || '';

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse analysis', raw: responseText }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      ...analysis,
      sessionCount: unresolvedSessions.length,
      analyzedDays: days,
    });
  } catch (err) {
    console.error('Analysis error:', err);
    return NextResponse.json(
      { error: 'Analysis failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

function buildPerAppPrompt(
  sessionSummaries: Record<string, unknown>[],
  days: number,
  appId: string,
): string {
  return `Analyze these ${sessionSummaries.length} unresolved feedback sessions from the last ${days} days for the "${appId}" app. Identify bugs, patterns, recurring user pain points, and suggest prioritized actions specific to this app.

FEEDBACK DATA:
${JSON.stringify(sessionSummaries, null, 2)}

Respond with JSON in this exact format:
{
  "themes": [
    {
      "name": "Theme name",
      "description": "What this theme covers",
      "frequency": <number of sessions mentioning this>,
      "severity": "critical" | "major" | "minor",
      "affectedApps": ["${appId}"],
      "relatedSessionIds": ["id1", "id2"],
      "recommendation": "Specific actionable fix for this app"
    }
  ],
  "summary": "1-2 sentence summary of this app's feedback patterns",
  "topPriority": "Single most impactful thing to fix in this app"
}`;
}

function buildCrossAppPrompt(
  sessionSummaries: Record<string, unknown>[],
  days: number,
): string {
  return `Analyze these ${sessionSummaries.length} unresolved feedback sessions from the last ${days} days across multiple Sevaro apps. Focus on:

1. CROSS-APP PATTERNS: Issues or themes that appear in 2+ different apps (e.g., "login confusion" across multiple products). These are the most valuable findings.
2. PORTFOLIO HEALTH: Which apps have the most feedback, highest severity, and which are suspiciously quiet.
3. SYSTEMIC RECOMMENDATIONS: Improvements that should be applied across the board — shared UX patterns, common infrastructure fixes, design consistency issues.

FEEDBACK DATA:
${JSON.stringify(sessionSummaries, null, 2)}

Respond with JSON in this exact format:
{
  "themes": [
    {
      "name": "Theme name",
      "description": "What this theme covers and which apps are affected",
      "frequency": <number of sessions mentioning this>,
      "severity": "critical" | "major" | "minor",
      "affectedApps": ["app1", "app2"],
      "relatedSessionIds": ["id1", "id2"],
      "recommendation": "What to do about it across the portfolio"
    }
  ],
  "summary": "1-2 sentence portfolio-level summary highlighting cross-app patterns",
  "topPriority": "Single most impactful systemic improvement"
}`;
}
