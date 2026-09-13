// Host-only candidate preparation. This module never approves, publishes, or dispatches notifications.
import { open, readFile, lstat, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assemble, ContextError, canonical, exact, identifier, instant, sha256 } from './context.mjs';
import { collectSources } from './collector.mjs';
import { LINK_HOSTS, prepareRelease, validateSnapshot } from './release.mjs';

const CURRENT = 'proposed-current-context.json';
const PRIOR = 'proposed-prior-context.json';
const HEALTH = 'refresh-health.json';
const LOCK = '.command-center-refresh.lock';
const SAFE_FAILURES = new Set(['run_failed', 'source_unavailable', 'permission_required', 'rate_limited', 'source_conflict']);
const SOURCE_FAILURES = new Set([...SAFE_FAILURES, 'source_stale']);

function failureCode(error) { return SAFE_FAILURES.has(error?.code) ? error.code : 'run_failed'; }
function safeTime(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null; }

async function privateRoot(input) {
  const alias = resolve(input);
  let info, root;
  try { info = await lstat(alias); root = await realpath(alias); } catch { throw new ContextError('private_output_directory_required'); }
  // macOS may canonicalize /var through /private/var even when the supplied leaf is not a symlink.
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0) throw new ContextError('private_output_directory_required');
  for (let parent = root;; parent = dirname(parent)) {
    try { await lstat(join(parent, '.git')); throw new ContextError('repository_output_forbidden'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    if (parent === dirname(parent)) return root;
  }
}

async function privateFile(path, { optional = true } = {}) {
  let info;
  try { info = await lstat(path); } catch (error) { if (optional && error.code === 'ENOENT') return null; throw new ContextError('private_file_required'); }
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0 || info.size > 128_000) throw new ContextError('private_file_required');
  return readFile(path, 'utf8');
}

async function readJson(path) {
  const text = await privateFile(path);
  if (text === null) return null;
  try { return JSON.parse(text); } catch { throw new ContextError('invalid_context'); }
}
async function readReceipt(path) {
  try { return await readJson(path); }
  catch (error) { if (error?.code === 'invalid_context') return null; throw error; }
}

function nullableInstant(value) { if (value !== null) instant(value); }
function validHealth(receipt, now) {
  if (!receipt) return null;
  try {
    exact(receipt, ['schema_version','last_attempt_at','last_success_at','last_failure_at','last_failure_code','failure_code','candidate_digest','candidate_expires_at','candidate_classification','freshness_state','recovery_state','source_counts','sources','delta']);
    if (receipt.schema_version !== 1) throw new ContextError('invalid_context');
    instant(receipt.last_attempt_at); nullableInstant(receipt.last_success_at); nullableInstant(receipt.last_failure_at); nullableInstant(receipt.candidate_expires_at);
    if (instant(receipt.last_attempt_at) > now || [receipt.last_success_at, receipt.last_failure_at].some(t => t !== null && instant(t) > instant(receipt.last_attempt_at))) throw new ContextError('invalid_context');
    if (![null, ...SAFE_FAILURES].includes(receipt.last_failure_code) || ![null, ...SAFE_FAILURES].includes(receipt.failure_code)) throw new ContextError('invalid_context');
    if (receipt.candidate_digest !== null && !/^[a-f0-9]{64}$/.test(receipt.candidate_digest)) throw new ContextError('invalid_context');
    if (![null, 'executive-pending-review'].includes(receipt.candidate_classification) || !['fresh','degraded','expired','missing','retained_previous'].includes(receipt.freshness_state) || !['none','used_prior','replaced_invalid_current','missing'].includes(receipt.recovery_state)) throw new ContextError('invalid_context');
    exact(receipt.source_counts, ['available','unavailable','stale']);
    if (!Object.values(receipt.source_counts).every(value => Number.isSafeInteger(value) && value >= 0) || !Array.isArray(receipt.sources)) throw new ContextError('invalid_context');
    const ids = new Set();
    for (const source of receipt.sources) {
      exact(source, ['source_id','state','failure_code']); identifier(source.source_id);
      if (ids.has(source.source_id) || !['available','unavailable','stale'].includes(source.state) || ![null, ...SOURCE_FAILURES].includes(source.failure_code)) throw new ContextError('invalid_context');
      ids.add(source.source_id);
    }
    if (receipt.sources.length > 50 || Object.keys(receipt.source_counts).some(state => receipt.source_counts[state] !== receipt.sources.filter(s => s.state === state).length)) throw new ContextError('invalid_context');
    exact(receipt.delta, ['added','removed','changed','revision_only','health_changed']);
    if (!Object.values(receipt.delta).every(value => Number.isSafeInteger(value) && value >= 0)) throw new ContextError('invalid_context');
    return receipt;
  } catch { return null; }
}

async function candidateAt(path, now) {
  try {
    const snapshot = await readJson(path);
    if (!snapshot) return { snapshot: null, invalid: false };
    // Validate against its own creation time so an expired but otherwise intact candidate remains recoverable.
    await validateSnapshot(snapshot, Date.parse(snapshot.generated_at));
    if (snapshot.classification !== 'executive-pending-review' || instant(snapshot.generated_at) > now + 60_000) throw new ContextError('invalid_context');
    return { snapshot, invalid: false };
  } catch (error) {
    if (error?.code === 'private_file_required') throw error;
    // Malformed/tampered JSON is recoverable; filesystem access failures are not.
    if (error instanceof ContextError) return { snapshot: null, invalid: true };
    throw error;
  }
}

async function atomicJson(root, name, value) {
  const target = join(root, name);
  const temp = join(root, `.${name}.${process.pid}.${crypto.randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(value) + '\n', 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    await rename(temp, target);
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temp).catch(() => {}); // only the name allocated by this invocation
    throw error;
  }
}

function itemMap(snapshot) { return new Map((snapshot?.items ?? []).map(item => [item.item_id, item])); }
function withoutRevision(item) { const { number, source_revision, ...rest } = item; return rest; }
function same(a, b) { return canonical(a) === canonical(b); }
function healthMap(snapshot) { return new Map((snapshot?.health ?? []).map(row => [row.source_id, row])); }

export function compareCandidates(previous, next) {
  const before = itemMap(previous), after = itemMap(next);
  let added = 0, removed = 0, changed = 0, revision_only = 0, health_changed = 0, new_failure = false, recovery = false;
  for (const [id, item] of after) {
    if (!before.has(id)) { added++; continue; }
    const old = before.get(id);
    if (same(withoutRevision(old), withoutRevision(item))) {
      if (old.source_revision !== item.source_revision) revision_only++;
    } else changed++;
  }
  for (const id of before.keys()) if (!after.has(id)) removed++;
  const oldHealth = healthMap(previous), newHealth = healthMap(next);
  for (const [id, row] of newHealth) {
    const old = oldHealth.get(id);
    if (!old || old.state !== row.state || old.failure_code !== row.failure_code) {
      health_changed++;
      if (row.state !== 'available' && old?.state === 'available') new_failure = true;
      if (row.state === 'available' && old && old.state !== 'available') recovery = true;
      if (!old && row.state !== 'available') new_failure = true;
    }
  }
  for (const id of oldHealth.keys()) {
    if (!newHealth.has(id)) { health_changed++; new_failure = true; }
  }
  return { added, removed, changed, revision_only, health_changed, new_failure, recovery };
}

function sourceReceipt(snapshot) {
  const sources = (snapshot?.health ?? []).map(({ source_id, state, failure_code }) => ({ source_id, state, failure_code }));
  const counts = { available: 0, unavailable: 0, stale: 0 };
  for (const source of sources) counts[source.state]++;
  return { sources, counts };
}

function freshness(snapshot, now) {
  if (!snapshot) return 'missing';
  const expiry = safeTime(snapshot.expires_at);
  if (!expiry || Date.parse(expiry) <= now) return 'expired';
  return snapshot.health?.some(row => row.state !== 'available') ? 'degraded' : 'fresh';
}

async function acquireLock(root) {
  try { return await open(join(root, LOCK), 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new ContextError('refresh_locked'); throw error; }
}

/** Prepare a pending candidate and metadata-only receipt in a canonical private directory. */
export async function refreshOnce({ root, plan, collect = collectSources, now = Date.now(), includePortfolio = false, ttlMs = 900000, write = atomicJson }) {
  const directory = await privateRoot(root);
  const lock = await acquireLock(directory);
  const attemptedAt = new Date(now).toISOString();
  try {
    const current = await candidateAt(join(directory, CURRENT), now);
    const prior = await candidateAt(join(directory, PRIOR), now);
    const previous = current.snapshot ?? prior.snapshot;
    const previousHealth = validHealth(await readReceipt(join(directory, HEALTH)), now);
    let snapshot, release, comparison, failure_code = null, collected = null, validatedCollection = null;
    try {
      collected = await collect(plan);
      if (!collected || !Array.isArray(collected.expected_sources) || !Array.isArray(collected.feeds)) throw new ContextError('source_unavailable');
      const next = await assemble(collected.feeds, { expectedSources: collected.expected_sources, allowedHosts: LINK_HOSTS, now, ttlMs, classification: 'executive-pending-review', includePortfolio });
      validatedCollection = next;
      if(!next.health.some(h=>h.state==='available'))throw new ContextError('source_unavailable');
      const prepared = await prepareRelease(next, now);
      comparison = compareCandidates(previous, next);

      // Keep exactly one prior candidate. A completed current always has a valid prior or none.
      // Never move the live candidate away before a replacement is durable.
      // A corrupt current is never rotated into the prior recovery slot.
      if (current.snapshot) await write(directory, PRIOR, current.snapshot);
      await write(directory, CURRENT, next);
      snapshot = next; release = prepared;
    } catch (error) {
      failure_code = failureCode(error);
      comparison = { added: 0, removed: 0, changed: 0, revision_only: 0, health_changed: 0, new_failure: previousHealth?.failure_code === null || !previousHealth, recovery: false };
    }
    const candidate = snapshot ?? previous;
    const recovery_state = current.snapshot ? 'none' : prior.snapshot ? snapshot && current.invalid ? 'replaced_invalid_current' : 'used_prior' : 'missing';
    // Do not copy unvalidated collected values into health after a failed validation.
    const receipt = sourceReceipt(validatedCollection ?? candidate);
    if(failure_code && !validatedCollection) {
      receipt.sources=receipt.sources.map(s=>({...s,state:'unavailable',failure_code}));
      receipt.counts={available:0,unavailable:receipt.sources.length,stale:0};
    }
    const health = {
      schema_version: 1,
      last_attempt_at: attemptedAt,
      last_success_at: snapshot ? attemptedAt : (previousHealth?.last_success_at ?? null),
      last_failure_at: failure_code ? attemptedAt : previousHealth?.last_failure_at ?? null,
      last_failure_code: failure_code ?? previousHealth?.last_failure_code ?? null,
      failure_code,
      candidate_digest: snapshot ? release.digest : candidate ? await sha256(candidate) : null,
      candidate_expires_at: candidate?.expires_at ?? null,
      candidate_classification: candidate?.classification ?? null,
      freshness_state: failure_code ? candidate ? 'retained_previous' : 'missing' : freshness(candidate, now),
      recovery_state,
      source_counts: receipt.counts,
      sources: receipt.sources,
      delta: { added: comparison.added, removed: comparison.removed, changed: comparison.changed, revision_only: comparison.revision_only, health_changed: comparison.health_changed }
    };
    // Receipt is deliberately last: it never exposes source content and describes a completed candidate write.
    await atomicJson(directory, HEALTH, health);
    const material = comparison.added + comparison.removed + comparison.changed > 0;
    const notify = !previous && !!snapshot || material || comparison.new_failure || comparison.recovery || !!snapshot && (!!previousHealth?.failure_code || !!previous && !current.snapshot);
    return { ok: !failure_code, requires_review: true, notify, failure_code, candidate_digest: health.candidate_digest, candidate_expires_at: health.candidate_expires_at, delta: health.delta, freshness_state: health.freshness_state, recovery_state };
  } finally {
    await lock.close().catch(() => {});
    await unlink(join(directory, LOCK)).catch(() => {});
  }
}
