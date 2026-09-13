import {isAllowedSourceUrl} from './source-links.mjs';
// Shared, transport-independent executive projection. Never an authority for source state.
export const SYSTEMS = Object.freeze(['asana', 'github', 'claude', 'asana_sync']);
export const KINDS = Object.freeze(['decision', 'response', 'deadline', 'blocker', 'waiting', 'project', 'agent', 'meeting']);
const MAX_ITEMS = 100;
export class ContextError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function requireThat(test, code = 'invalid_context') { if (!test) throw new ContextError(code); }
export function exact(value, keys) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value));
  requireThat(Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k)), 'unexpected_fields');
}
export function instant(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)), 'invalid_time');
  return Date.parse(value);
}
export function deadline(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = Date.parse(value);
    requireThat(Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0,10) === value, 'invalid_time'); return parsed;
  }
  return instant(value);
}
export function label(value, max = 320) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(value), 'invalid_text');
  return value;
}
export function identifier(value) { requireThat(typeof value === 'string' && /^[a-zA-Z0-9:_./-]{1,160}$/.test(value), 'invalid_id'); return value; }
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  requireThat(value === null || ['string', 'number', 'boolean'].includes(typeof value), 'invalid_value');
  requireThat(typeof value !== 'number' || Number.isFinite(value), 'invalid_value');
  return JSON.stringify(value);
}
export async function sha256(value) {
  const bytes = new TextEncoder().encode(canonical(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function url(value, allowedHosts) { requireThat(isAllowedSourceUrl(value, allowedHosts), 'invalid_link'); }
export function validateItem(item, allowedHosts) {
  exact(item, ['item_id', 'source_id', 'source_revision', 'source_url', 'spoken_name', 'kind', 'status', 'context', 'recommendation', 'requires_steve', 'due', 'next_event', 'action_state']);
  identifier(item.item_id); identifier(item.source_id); label(item.source_revision, 100); url(item.source_url, allowedHosts);
  label(item.spoken_name, 80); label(item.status, 100); label(item.context, 600);
  if (item.recommendation !== null) label(item.recommendation, 400);
  if (item.next_event !== null) label(item.next_event, 240);
  if (item.due !== null) deadline(item.due);
  requireThat(KINDS.includes(item.kind) && typeof item.requires_steve === 'boolean' && ['none', 'proposed', 'awaiting_approval'].includes(item.action_state));
  // These fields are curated upstream, not sanitised from raw mail or transcripts.
  // Strict shape and limits are defence in depth, NOT a PHI classifier.
}
export function validateFeed(feed, allowedHosts, now = Date.now()) {
  exact(feed, ['schema_version', 'source_id', 'system', 'observed_at', 'expires_at', 'status', 'failure_code', 'items']);
  requireThat(feed.schema_version === 1 && SYSTEMS.includes(feed.system)); identifier(feed.source_id);
  const observed = instant(feed.observed_at), expires = instant(feed.expires_at);
  requireThat(observed <= now + 60_000 && expires > observed && expires - observed <= 24 * 3600_000, 'invalid_freshness');
  requireThat(['available', 'partial', 'unavailable'].includes(feed.status));
  requireThat(feed.failure_code === null || ['source_unavailable', 'permission_required', 'rate_limited', 'source_conflict', 'run_failed'].includes(feed.failure_code));
  requireThat(Array.isArray(feed.items) && feed.items.length <= MAX_ITEMS);
  requireThat(feed.status === 'unavailable' ? feed.items.length === 0 && feed.failure_code !== null : feed.failure_code === null);
  const seen = new Set();
  for (const item of feed.items) {
    validateItem(item, allowedHosts);
    requireThat(item.source_id === feed.source_id && !seen.has(item.item_id), 'duplicate_or_wrong_source'); seen.add(item.item_id);
  }
  return feed;
}
export function isTodayItem(i, now) {
  return i.requires_steve || i.kind === 'blocker' || i.kind === 'waiting' ||
    (i.kind === 'agent' && ['Queue stuck','Sync needs attention','Queued updates','Draft pull request','Open pull request'].includes(i.status)) ||
    (i.kind === 'deadline' && i.due !== null && deadline(i.due) <= now + 48 * 3600_000) ||
    (i.kind === 'meeting' && i.due !== null && deadline(i.due) >= now && deadline(i.due) <= now + 48 * 3600_000);
}
export async function assemble(feeds, { expectedSources, allowedHosts, now = Date.now(), ttlMs = 15 * 60_000, classification = 'synthetic-only', includePortfolio = false }) {
  requireThat(['synthetic-only', 'executive-pending-review', 'executive-reviewed'].includes(classification));
  requireThat(Array.isArray(expectedSources) && expectedSources.length > 0 && expectedSources.length <= 50);
  expectedSources.forEach(identifier); requireThat(new Set(expectedSources).size === expectedSources.length);
  requireThat(ttlMs > 0 && ttlMs <= 7200_000 && Array.isArray(allowedHosts) && allowedHosts.length > 0);
  const bySource = new Map(), byItem = new Map(), health = [];
  for (const feed of feeds) {
    validateFeed(feed, allowedHosts, now);
    requireThat(expectedSources.includes(feed.source_id) && !bySource.has(feed.source_id), 'duplicate_or_unexpected_source'); bySource.set(feed.source_id, feed);
  }
  let expiry = now + ttlMs;
  for (const sourceId of [...expectedSources].sort()) {
    const feed = bySource.get(sourceId);
    const state = !feed ? 'unavailable' : feed.status === 'unavailable' ? 'unavailable' : instant(feed.expires_at) <= now ? 'stale' : feed.status;
    health.push({ source_id: sourceId, state, observed_at: feed?.observed_at ?? null, failure_code: feed?.failure_code ?? (['available','partial'].includes(state) ? null : state === 'stale' ? 'source_stale' : 'source_unavailable') });
    if (!['available', 'partial'].includes(state)) continue;
    expiry = Math.min(expiry, instant(feed.expires_at));
    for (const item of feed.items) {
      requireThat(!byItem.has(item.item_id), 'conflicting_item'); byItem.set(item.item_id, structuredClone(item));
    }
  }
  const all = [...byItem.values()].sort((a,b) => a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0);
  // Explicit portfolio review may include approved project summaries. Today remains exception-only.
  const visible = all.filter(item => isTodayItem(item, now) || includePortfolio && item.kind === 'project');
  requireThat(visible.length <= MAX_ITEMS, 'too_many_items');
  const items = visible.map((item, i) => ({ ...item, number: i + 1 }));
  const today = items.filter(item => isTodayItem(item, now));
  const data = { schema_version: 1, classification, generated_at: new Date(now).toISOString(), expires_at: new Date(expiry).toISOString(), health, items, today_item_ids: today.map(i => i.item_id), requiring_steve: items.filter(i => i.requires_steve).length };
  const digest = await sha256(data);
  return freeze({ ...data, snapshot_id: 'snapshot-' + digest, view_id: 'today-' + digest });
}
export function readSnapshot(snapshot, pins, now = Date.now()) {
  exact(pins, ['snapshot_id', 'view_id']);
  requireThat(snapshot.snapshot_id === pins.snapshot_id && snapshot.view_id === pins.view_id, 'snapshot_changed');
  requireThat(instant(snapshot.expires_at) > now, 'snapshot_expired'); return snapshot;
}
export function resolveReference(snapshot, pins, phrase, now = Date.now()) {
  readSnapshot(snapshot, pins, now); label(phrase, 120);
  const match = /^(?:tell me (?:more )?about |show me )?(?:number |item )?(one|two|three|four|five|six|seven|eight|nine|ten|[1-9]\d?|100)\??\.?$/i.exec(phrase.trim());
  requireThat(match, 'clarification_required');
  const words = ['one','two','three','four','five','six','seven','eight','nine','ten'];
  const number = /^\d+$/.test(match[1]) ? Number(match[1]) : words.indexOf(match[1].toLowerCase()) + 1;
  const item = snapshot.items.find(i => i.number === number); requireThat(item, 'unknown_item');
  return { snapshot_id: snapshot.snapshot_id, view_id: snapshot.view_id, item };
}
