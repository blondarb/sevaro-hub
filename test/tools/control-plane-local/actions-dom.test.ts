// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

it('shows exact target and inert payload, requires attestation and never re-enables a consumed confirmation', async () => {
  document.body.innerHTML = '<ul id="action-previews"></ul><p id="action-message"></p>';
  let writes = 0;
  const hostile = '<img src=x onerror="window.injected=true">';
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    if (init?.method === 'POST') {
      writes += 1;
      return { status: 409, ok: false, json: async () => ({ error: 'action_outcome_uncertain' }) };
    }
    return { ok: true, json: async () => ({ csrf_nonce: 'synthetic-csrf', previews: [{
      proposer_consumers: ['codex', 'claude_code'], preview_id: '123e4567-e89b-42d3-a456-426614174000',
      action_sha256: 'a'.repeat(64),
      expires_at: '2030-01-01T00:00:00Z', action: { action: 'comment_task', task_gid: '12345', text: hostile },
    }] }) };
  }));
  const source = readFileSync('tools/control-plane-local/public/dashboard.js', 'utf8');
  const run = new Function(`${source.replace(/load\(\);\s*$/, '')}; return loadActions();`);
  await run();
  expect(JSON.parse(document.querySelector('pre')!.textContent!).text).toBe(hostile);
  expect(document.querySelector('img')).toBeNull();
  expect(document.querySelector('a')?.href).toBe('https://app.asana.com/0/0/12345');
  const button = document.querySelector('button')!;
  const checkbox = document.querySelector('input')!;
  button.click();
  expect(writes).toBe(0);
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change'));
  expect(button.disabled).toBe(false);
  button.click();
  await vi.waitFor(() => expect(document.querySelector('#action-message')?.textContent).toContain('uncertain'));
  checkbox.checked = false; checkbox.dispatchEvent(new Event('change'));
  checkbox.checked = true; checkbox.dispatchEvent(new Event('change'));
  expect(button.disabled).toBe(true);
  button.click();
  expect(writes).toBe(1);
});
