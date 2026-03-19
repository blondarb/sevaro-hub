import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'us-east-2' });
const MODEL_ID = 'us.anthropic.claude-sonnet-4-6-20250514-v1:0';

export async function POST(request: Request) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { promptText, feature, appName } = await request.json();
  if (!promptText) {
    return NextResponse.json({ error: 'promptText is required' }, { status: 400 });
  }

  try {
    const result = await bedrock.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: `You summarize AI system prompts in plain English for a non-technical reviewer. Given a prompt, produce a brief summary that explains:

1. PURPOSE: What this prompt tells the AI to do (1 sentence)
2. SCOPE: What data it processes and what it produces (1 sentence)
3. GUARDRAILS: Key safety rules or limitations (1 sentence)

Respond with ONLY valid JSON:
{
  "purpose": "one sentence",
  "scope": "one sentence",
  "guardrails": "one sentence"
}

Keep it concise — this appears on a summary card. Use plain language, not jargon.` }],
      messages: [{
        role: 'user',
        content: [{ text: `App: ${appName || 'unknown'}\nFeature: ${feature || 'unknown'}\n\nPROMPT:\n${promptText}` }],
      }],
      inferenceConfig: { maxTokens: 500, temperature: 0.1 },
    }));

    const text = result.output?.message?.content?.[0]?.text || '';
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Prompt summarize error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Summarization failed' },
      { status: 500 },
    );
  }
}
