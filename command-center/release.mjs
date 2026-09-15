import { exact, requireThat, instant, validateItem, sha256, canonical, identifier, ContextError, isTodayItem } from './context.mjs';
import {validateDerivedRefresh} from './refresh-grant.mjs';
export const MAX_RELEASE_BYTES = 65536;
const CHUNK_BYTES = 4096;
const MAX_CHUNKS = 16;
const present = value => value !== undefined && value !== null && value !== '';
// Sites limits each binding to about 5 KiB. Chunk only the protected transport;
// the canonical payload, approval digest and immutable snapshot remain identical.
export function snapshotBindings(payload) {
  requireThat(typeof payload === 'string' && new TextEncoder().encode(payload).byteLength <= MAX_RELEASE_BYTES, 'release_too_large');
  const chunks = []; let chunk = '', size = 0;
  for (const point of payload) {
    const bytes = new TextEncoder().encode(point).byteLength;
    if (size + bytes > CHUNK_BYTES) { chunks.push(chunk); chunk = ''; size = 0; }
    chunk += point; size += bytes;
  }
  if (chunk) chunks.push(chunk);
  requireThat(chunks.length > 0 && chunks.length <= MAX_CHUNKS, 'release_too_large');
  return { CONTEXT_SNAPSHOT_CHUNK_COUNT: String(chunks.length), ...Object.fromEntries(chunks.map((v,i) => ['CONTEXT_SNAPSHOT_CHUNK_'+i,v])) };
}
function runtimePayload(env) {
  const keys = Object.keys(env).filter(k => k.startsWith('CONTEXT_SNAPSHOT_CHUNK_') && k !== 'CONTEXT_SNAPSHOT_CHUNK_COUNT' && present(env[k]));
  if (!present(env.CONTEXT_SNAPSHOT_CHUNK_COUNT)) {
    requireThat(keys.length === 0 && typeof env.CONTEXT_SNAPSHOT === 'string', 'context_unavailable');
    return env.CONTEXT_SNAPSHOT;
  }
  requireThat(!present(env.CONTEXT_SNAPSHOT), 'context_unavailable_mixed_transport');
  requireThat(/^(?:[1-9]|1[0-6])$/.test(env.CONTEXT_SNAPSHOT_CHUNK_COUNT), 'context_unavailable_chunk_count');
  const count = Number(env.CONTEXT_SNAPSHOT_CHUNK_COUNT);
  requireThat(keys.length === count && keys.every(k => Array.from({length:count},(_,i) => 'CONTEXT_SNAPSHOT_CHUNK_'+i).includes(k)), 'context_unavailable_chunk_keys');
  return Array.from({length:count},(_,i) => {
    const value = env['CONTEXT_SNAPSHOT_CHUNK_'+i];
    requireThat(typeof value === 'string' && value.length > 0 && new TextEncoder().encode(value).byteLength <= CHUNK_BYTES, 'context_unavailable_chunk_size');
    return value;
  }).join('');
}
export const LINK_HOSTS = Object.freeze(['app.asana.com', 'github.com', 'outlook.office.com', 'outlook.office365.com', 'drive.google.com', 'sevarohealth.slack.com']);
/** This validates a previously reviewed projection, never classifies raw content as PHI-free. */
export async function validateSnapshot(snapshot, now = Date.now()) {
  exact(snapshot, ['schema_version', 'classification', 'generated_at', 'expires_at', 'health', 'items', 'today_item_ids', 'requiring_steve', 'snapshot_id', 'view_id']);
  requireThat([1,2].includes(snapshot.schema_version) && ['synthetic-only','executive-pending-review','executive-reviewed'].includes(snapshot.classification));
  const created = instant(snapshot.generated_at), expiry = instant(snapshot.expires_at);
  requireThat(created <= now + 60_000 && expiry > now && expiry > created && expiry - created <= 7200_000, 'snapshot_expired');
  requireThat(Array.isArray(snapshot.items) && snapshot.items.length <= 100 && Array.isArray(snapshot.health) && snapshot.health.length <= 50);
  const sourceIds = new Set();
  for (const h of snapshot.health) {
    exact(h, ['source_id','state','observed_at','failure_code']); identifier(h.source_id);
    requireThat(!sourceIds.has(h.source_id), 'duplicate_source'); sourceIds.add(h.source_id);
    requireThat(['available','partial','unavailable','stale'].includes(h.state));
    if (h.observed_at !== null) requireThat(instant(h.observed_at) <= now + 60_000);
    requireThat(h.failure_code === null || ['source_unavailable','source_stale','permission_required','rate_limited','source_conflict','run_failed'].includes(h.failure_code));
    requireThat(!['available','partial'].includes(h.state) || h.observed_at !== null && h.failure_code === null);
  }
  const seen = new Set();
  for (const [index, row] of snapshot.items.entries()) {
    const {number, retention, ...item} = row; requireThat(number === index + 1, 'invalid_numbering'); validateItem(item, LINK_HOSTS);
    if(Object.hasOwn(row,'retention')) {
      requireThat(snapshot.schema_version===2&&snapshot.classification!=='synthetic-only','invalid_retention');
      exact(retention,['state','source_observed_at','review_expires_at','snapshot_digest']);
      requireThat(retention.state==='historical-needs-recheck'&&/^[a-f0-9]{64}$/.test(retention.snapshot_digest),'invalid_retention');
      requireThat(instant(retention.source_observed_at)<=created&&instant(retention.review_expires_at)>instant(retention.source_observed_at),'invalid_retention_time');
      requireThat(item.action_state==='none'&&!item.evidence,'historical_action_forbidden');
      requireThat(!['permission_required','source_conflict'].includes(snapshot.health.find(h=>h.source_id===item.source_id)?.failure_code),'invalid_provenance');
    }
    requireThat(!Object.hasOwn(item,'same_obligation_as'),'source_conflict');
    for (const evidence of item.evidence ?? []) requireThat(snapshot.health.some(h=>h.source_id===evidence.source_id && ['available','partial'].includes(h.state)),'invalid_provenance');
    requireThat(sourceIds.has(item.source_id) && (retention||['available','partial'].includes(snapshot.health.find(h=>h.source_id===item.source_id).state)) && !seen.has(item.item_id), 'invalid_provenance'); seen.add(item.item_id);
  }
  requireThat(snapshot.items.every(item => item.retention || isTodayItem(item, created) || item.kind === 'project') && canonical(snapshot.today_item_ids) === canonical(snapshot.items.filter(item => item.retention || isTodayItem(item, created)).map(item => item.item_id)), 'invalid_today_view');
  requireThat(snapshot.requiring_steve === snapshot.items.filter(i=>i.requires_steve).length);
  const {snapshot_id,view_id,...body} = snapshot, hash = await sha256(body);
  requireThat(snapshot_id === 'snapshot-' + hash && view_id === 'today-' + hash, 'digest_mismatch');
  return snapshot;
}
export async function prepareRelease(snapshot, now = Date.now()) {
  await validateSnapshot(snapshot, now);
  const payload = canonical(snapshot);
  requireThat(new TextEncoder().encode(payload).byteLength <= MAX_RELEASE_BYTES, 'release_too_large');
  // Returned only to the trusted local operator, never logged by the CLI.
  return { payload, digest: await sha256(snapshot), expires_at: snapshot.expires_at };
}
export async function loadRuntimeSnapshot(env, now = Date.now()) {
  requireThat(typeof env.CONTEXT_RELEASE_SHA256 === 'string', 'context_unavailable');
  const payload = runtimePayload(env);
  requireThat(new TextEncoder().encode(payload).byteLength <= MAX_RELEASE_BYTES, 'release_too_large');
  let snapshot; try { snapshot = JSON.parse(payload); } catch { throw new ContextError('invalid_context'); }
  await validateSnapshot(snapshot, now);
  requireThat(await sha256(snapshot) === env.CONTEXT_RELEASE_SHA256, 'release_not_approved');
  requireThat(snapshot.classification !== 'executive-pending-review', 'review_required');
  // This switch must remain absent until hosted negative-auth and exact-content approval gates are recorded.
  requireThat(snapshot.classification === 'synthetic-only' || env.CONTEXT_REAL_DATA_ENABLED === 'approved', 'real_data_disabled');
  if (snapshot.classification === 'executive-reviewed') {
    if (present(env.CONTEXT_REFRESH_RECEIPT)) {
      requireThat(!present(env.CONTEXT_APPROVAL_RECEIPT),'mixed_approval_modes');
      let receipt,grant;
      try {receipt=JSON.parse(env.CONTEXT_REFRESH_RECEIPT);grant=JSON.parse(env.CONTEXT_REFRESH_GRANT);} catch {throw new ContextError('refresh_authorization_required');}
      await validateDerivedRefresh(snapshot,receipt,grant,now);
      return snapshot;
    }
    let approval; try { approval = JSON.parse(env.CONTEXT_APPROVAL_RECEIPT); } catch { throw new ContextError('approval_required'); }
    exact(approval, ['digest','approved_by','approved_at','expires_at','scope']);
    requireThat(approval.digest === env.CONTEXT_RELEASE_SHA256 && approval.approved_by === 'Steve' && approval.scope === 'owner-only-read-only-site', 'approval_required');
    requireThat(instant(approval.approved_at) >= instant(snapshot.generated_at) && instant(approval.approved_at) <= now && instant(approval.expires_at) > now && instant(approval.expires_at) <= instant(snapshot.expires_at), 'approval_expired');
  }
  return snapshot;
}
