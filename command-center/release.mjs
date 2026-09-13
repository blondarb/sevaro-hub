import { exact, requireThat, instant, validateItem, sha256, canonical, identifier, ContextError, isTodayItem } from './context.mjs';
export const MAX_RELEASE_BYTES = 65536;
export const LINK_HOSTS = Object.freeze(['app.asana.com', 'github.com', 'outlook.office.com', 'drive.google.com']);
/** This validates a previously reviewed projection, never classifies raw content as PHI-free. */
export async function validateSnapshot(snapshot, now = Date.now()) {
  exact(snapshot, ['schema_version', 'classification', 'generated_at', 'expires_at', 'health', 'items', 'today_item_ids', 'requiring_steve', 'snapshot_id', 'view_id']);
  requireThat(snapshot.schema_version === 1 && ['synthetic-only','executive-pending-review','executive-reviewed'].includes(snapshot.classification));
  const created = instant(snapshot.generated_at), expiry = instant(snapshot.expires_at);
  requireThat(created <= now + 60_000 && expiry > now && expiry > created && expiry - created <= 7200_000, 'snapshot_expired');
  requireThat(Array.isArray(snapshot.items) && snapshot.items.length <= 100 && Array.isArray(snapshot.health) && snapshot.health.length <= 50);
  const sourceIds = new Set();
  for (const h of snapshot.health) {
    exact(h, ['source_id','state','observed_at','failure_code']); identifier(h.source_id);
    requireThat(!sourceIds.has(h.source_id), 'duplicate_source'); sourceIds.add(h.source_id);
    requireThat(['available','unavailable','stale'].includes(h.state));
    if (h.observed_at !== null) requireThat(instant(h.observed_at) <= now + 60_000);
    requireThat(h.failure_code === null || ['source_unavailable','source_stale','permission_required','rate_limited','source_conflict','run_failed'].includes(h.failure_code));
    requireThat(h.state !== 'available' || h.observed_at !== null && h.failure_code === null);
  }
  const seen = new Set();
  for (const [index, row] of snapshot.items.entries()) {
    const {number, ...item} = row; requireThat(number === index + 1, 'invalid_numbering'); validateItem(item, LINK_HOSTS);
    requireThat(sourceIds.has(item.source_id) && snapshot.health.find(h=>h.source_id===item.source_id).state === 'available' && !seen.has(item.item_id), 'invalid_provenance'); seen.add(item.item_id);
  }
  requireThat(snapshot.items.every(item => isTodayItem(item, created) || item.kind === 'project') && canonical(snapshot.today_item_ids) === canonical(snapshot.items.filter(item => isTodayItem(item, created)).map(item => item.item_id)), 'invalid_today_view');
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
  requireThat(typeof env.CONTEXT_SNAPSHOT === 'string' && typeof env.CONTEXT_RELEASE_SHA256 === 'string', 'context_unavailable');
  requireThat(new TextEncoder().encode(env.CONTEXT_SNAPSHOT).byteLength <= MAX_RELEASE_BYTES, 'release_too_large');
  let snapshot; try { snapshot = JSON.parse(env.CONTEXT_SNAPSHOT); } catch { throw new ContextError('invalid_context'); }
  await validateSnapshot(snapshot, now);
  requireThat(await sha256(snapshot) === env.CONTEXT_RELEASE_SHA256, 'release_not_approved');
  requireThat(snapshot.classification !== 'executive-pending-review', 'review_required');
  // This switch must remain absent until hosted negative-auth and exact-content approval gates are recorded.
  requireThat(snapshot.classification === 'synthetic-only' || env.CONTEXT_REAL_DATA_ENABLED === 'approved', 'real_data_disabled');
  if (snapshot.classification === 'executive-reviewed') {
    let approval; try { approval = JSON.parse(env.CONTEXT_APPROVAL_RECEIPT); } catch { throw new ContextError('approval_required'); }
    exact(approval, ['digest','approved_by','approved_at','expires_at','scope']);
    requireThat(approval.digest === env.CONTEXT_RELEASE_SHA256 && approval.approved_by === 'Steve' && approval.scope === 'owner-only-read-only-site', 'approval_required');
    requireThat(instant(approval.approved_at) >= instant(snapshot.generated_at) && instant(approval.approved_at) <= now && instant(approval.expires_at) > now && instant(approval.expires_at) <= instant(snapshot.expires_at), 'approval_expired');
  }
  return snapshot;
}
