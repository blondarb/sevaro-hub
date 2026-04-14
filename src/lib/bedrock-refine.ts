import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-2' });
const MODEL_ID = 'us.anthropic.claude-sonnet-4-6';

export interface RefineInput {
  currentPrompt: string;
  refinementInstruction: string;
  sessionContext?: { classification?: string; excerpt?: string };
}

export interface RefineOutput {
  revisedPrompt: string;
  changeSummary: string;
}

const SYSTEM = `You are a prompt editor. The user will give you a draft Claude Code prompt and a natural-language instruction describing what to change. Rewrite the prompt to incorporate the instruction while:

- Preserving the original intent
- Not adding unrelated scope
- Not introducing new files or test requirements unless the instruction explicitly mentions them
- Keeping it as a standalone prompt a fresh Claude Code session can execute

Respond with ONLY a JSON object matching this shape: {"revisedPrompt": "<full rewritten prompt>", "changeSummary": "<one-sentence description of what changed>"}. No markdown fences, no preamble.`;

export async function refinePrompt(
  input: RefineInput,
): Promise<RefineOutput> {
  const contextBlock = input.sessionContext
    ? `\n\nSESSION CONTEXT:\nClassification: ${input.sessionContext.classification ?? ''}\nFeedback excerpt: ${input.sessionContext.excerpt ?? ''}`
    : '';
  const userMsg = `CURRENT PROMPT:\n${input.currentPrompt}\n\nINSTRUCTION:\n${input.refinementInstruction}${contextBlock}`;

  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM }],
      messages: [{ role: 'user', content: [{ text: userMsg }] }],
      inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
    }),
  );

  const text = res.output?.message?.content?.[0]?.text;
  if (!text) throw new Error('bedrock returned empty response');

  // Parse JSON. Attempt 1: raw trimmed text. Attempt 2: strip ```json ... ```
  // fences if present. Fail loudly if neither succeeds.
  let parsed: RefineOutput;
  try {
    parsed = JSON.parse(text.trim()) as RefineOutput;
  } catch {
    const unfenced = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();
    try {
      parsed = JSON.parse(unfenced) as RefineOutput;
    } catch {
      throw new Error(
        `bedrock returned unparseable JSON: ${text.slice(0, 200)}`,
      );
    }
  }

  if (
    typeof parsed.revisedPrompt !== 'string' ||
    typeof parsed.changeSummary !== 'string'
  ) {
    throw new Error('bedrock response missing required fields');
  }
  return parsed;
}
