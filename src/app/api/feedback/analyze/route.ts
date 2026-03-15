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

  try {
    const sessions = await listSessions();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const unresolvedSessions = sessions.filter((s) => {
      const isRecent = s.createdAt >= cutoff;
      const isUnresolved = !s.reviewStatus || s.reviewStatus === 'open' || s.reviewStatus === 'in_progress';
      return isRecent && isUnresolved;
    });

    if (unresolvedSessions.length === 0) {
      return NextResponse.json({
        themes: [],
        summary: 'No unresolved feedback sessions found in the selected time period.',
        sessionCount: 0,
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

    const prompt = `Analyze these ${sessionSummaries.length} unresolved feedback sessions from the last ${days} days across Sevaro apps. Identify patterns, recurring themes, and suggest prioritized actions.

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
      "affectedApps": ["app1", "app2"],
      "relatedSessionIds": ["id1", "id2"],
      "recommendation": "What to do about it"
    }
  ],
  "summary": "1-2 sentence overall summary",
  "topPriority": "Single most impactful thing to fix first"
}`;

    const converseResponse = await bedrock.send(new ConverseCommand({
      modelId: 'us.anthropic.claude-sonnet-4-6-20250514-v1:0',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 2000, temperature: 0.2 },
    }));

    const responseText = converseResponse.output?.message?.content?.[0]?.text || '';

    // Extract JSON from the response (may be wrapped in markdown code block)
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
