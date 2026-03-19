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

  const { promptText, feedbackText } = await request.json();
  if (!promptText || !feedbackText) {
    return NextResponse.json({ error: 'promptText and feedbackText are required' }, { status: 400 });
  }

  try {
    const result = await bedrock.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: `You are a prompt engineering assistant. Given an original prompt and user feedback, produce a refined version of the prompt that addresses the feedback while preserving the original intent and structure.

Respond with ONLY valid JSON in this format:
{
  "refinedPromptText": "the updated prompt text",
  "changeSummary": ["bullet 1 describing what changed and why", "bullet 2", ...]
}

Rules:
- Make targeted changes based on the feedback — don't rewrite the whole prompt
- Preserve the original structure, tone, and safety guardrails
- Each change summary bullet should explain what changed AND why (based on the feedback)
- If the feedback is unclear, make your best interpretation and note it in the summary` }],
      messages: [{
        role: 'user',
        content: [{ text: `ORIGINAL PROMPT:\n${promptText}\n\nUSER FEEDBACK:\n${feedbackText}` }],
      }],
      inferenceConfig: { maxTokens: 4000, temperature: 0.2 },
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
    console.error('Prompt refinement error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refinement failed' },
      { status: 500 },
    );
  }
}
