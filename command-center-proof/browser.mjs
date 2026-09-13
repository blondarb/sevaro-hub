const pins = Object.freeze({ snapshot_id: 'synthetic-context-20260913-v1', view_id: 'synthetic-today-v1' });
async function retrieve(path, args) {
  const r = await fetch(path + '?' + new URLSearchParams(args), { cache: 'no-store', credentials: 'same-origin' });
  if (!r.ok) throw new Error('context_unavailable');
  return r.json();
}
const state = document.querySelector('#state');
try {
  const context = await retrieve('/api/context', pins);
  if (context.snapshot_id !== pins.snapshot_id || context.view_id !== pins.view_id || context.classification !== 'synthetic-only')
    throw new Error('context_mismatch');
  document.querySelector('#items').replaceChildren(...context.items.map(item => {
    const row = document.createElement('li'); row.value = item.number; row.dataset.itemId = item.item_id;
    const name = document.createElement('strong'); name.textContent = item.spoken_name + ' · ' + item.status;
    const detail = document.createElement('p'); detail.textContent = item.context;
    const recommendation = document.createElement('p'); recommendation.textContent = item.recommendation;
    row.append(name, detail, recommendation); return row;
  }));
  document.querySelector('#receipt').textContent = context.snapshot_id + ' / ' + context.view_id;
  state.textContent = '3 numbered synthetic items. Native Voice acceptance pending.';
  // Registration is optional: absence must never be reported as Voice support.
  if (document.modelContext?.registerTool) {
    document.modelContext.registerTool({ name: 'read_shared_context', description: 'Read the exact immutable synthetic snapshot displayed on this page.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true }, execute: () => retrieve('/api/context', pins) });
    document.modelContext.registerTool({ name: 'resolve_shared_context_item', description: 'Resolve a numbered reference in the exact displayed synthetic snapshot. No actions.',
      inputSchema: { type: 'object', properties: { phrase: { type: 'string' } }, required: ['phrase'], additionalProperties: false },
      annotations: { readOnlyHint: true }, execute: ({ phrase }) => retrieve('/api/resolve', { ...pins, phrase }) });
    state.textContent = '3 numbered synthetic items. Read tools registered; native Voice acceptance pending.';
  }
} catch {
  document.querySelector('#items').replaceChildren();
  state.textContent = 'Context unavailable. Do not resolve an item from memory.';
}
