// Deliberately closed fixture: no caller-provided data, source feeds or persistence.
function freeze(value) {
  Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); });
  return Object.freeze(value);
}
export const snapshot = freeze({
  schema_version: 1,
  snapshot_id: 'synthetic-context-20260913-v1',
  view_id: 'synthetic-today-v1',
  classification: 'synthetic-only',
  generated_at: '2026-09-13T17:00:00Z',
  expires_at: '2026-09-20T17:00:00Z',
  items: [
    { number: 1, item_id: 'synthetic:decision:cedar', spoken_name: 'Cedar review',
      status: 'Decision proposed', context: 'Invented example: choose a time for a design review.',
      recommendation: 'Discuss the review window. This proof cannot schedule it.' },
    { number: 2, item_id: 'synthetic:blocker:harbor', spoken_name: 'Harbor dependency',
      status: 'Blocked', context: 'Invented example: a prototype is waiting for a sample specification.',
      recommendation: 'Ask for the sample specification. This proof cannot send a message.' },
    { number: 3, item_id: 'synthetic:meeting:maple', spoken_name: 'Maple preparation',
      status: 'Preparation needed', context: 'Invented example: review two design questions before a planning meeting.',
      recommendation: 'Discuss the two questions. No real calendar event is connected.' }
  ]
});

export function readContext(snapshotId, viewId, time = Date.now()) {
  if (snapshotId !== snapshot.snapshot_id || viewId !== snapshot.view_id)
    throw new Error('snapshot_or_view_mismatch');
  if (!Number.isFinite(time) || time >= Date.parse(snapshot.expires_at))
    throw new Error('snapshot_expired');
  return snapshot;
}

export function resolveItem({ snapshot_id, view_id, phrase }, time = Date.now()) {
  const current = readContext(snapshot_id, view_id, time);
  const words = new Map([['one', 1], ['two', 2], ['three', 3]]);
  // This is a reference resolver, not an intent/action engine. Reject ambiguity.
  const match = typeof phrase === 'string' && phrase.trim().toLowerCase()
    .match(/^(?:tell me (?:more )?about )?(?:number )?(one|two|three|[1-3])[?.!]?$/);
  if (!match) throw new Error('unresolved_reference');
  const number = words.get(match[1]) ?? Number(match[1]);
  return freeze({ snapshot_id, view_id, item: current.items.find(i => i.number === number) });
}
