import { ContextError, exact, requireThat, identifier, label, instant, validateFeed } from './context.mjs';
const ASANA_FIELDS = 'gid,modified_at,completed,due_on,due_at,assignee.gid,memberships.project.gid,memberships.section.gid';
export const asanaFields = ASANA_FIELDS;
function gid(value) { requireThat(typeof value === 'string' && /^\d{1,24}$/.test(value), 'invalid_target'); }
function feed(sourceId, system, observedAt, items, failure = null) {
  instant(observedAt);
  return { schema_version: 1, source_id: sourceId, system, observed_at: observedAt, expires_at: new Date(Date.parse(observedAt) + 7200_000).toISOString(), status: failure ? 'unavailable' : 'available', failure_code: failure, items: failure ? [] : items };
}
function code(error) { return ['permission_required','rate_limited','source_conflict'].includes(error?.code) ? error.code : 'source_unavailable'; }
async function jsonGet(fetcher, url, headers) {
  let r;
  try { r = await fetcher(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
  catch { throw new ContextError('source_unavailable'); }
  if (r.status === 401 || r.status === 403) throw new ContextError('permission_required');
  if (r.status === 429) throw new ContextError('rate_limited');
  requireThat(r.ok, 'source_unavailable');
  // No response bodies or raw upstream errors are logged.
  const length = Number(r.headers.get('content-length'));
  requireThat(!Number.isFinite(length) || length <= 512_000, 'source_unavailable');
  let value; try { const text = await r.text(); requireThat(text.length <= 512_000, 'source_unavailable'); value = JSON.parse(text); }
  catch { throw new ContextError('source_unavailable'); }
  return value;
}
function definition(entry) {
  exact(entry, ['target', 'spoken_name', 'kind', 'context', 'recommendation', 'requires_steve', 'next_event', 'action_state']);
  identifier(entry.target); label(entry.spoken_name,80);
}
function item(entry, sourceId, revision, sourceUrl, status, due = null) {
  return { item_id: sourceId + ':' + entry.target, source_id: sourceId, source_revision: revision, source_url: sourceUrl, spoken_name: entry.spoken_name, kind: entry.kind, context: entry.context, recommendation: entry.recommendation, requires_steve: entry.requires_steve, due, status, next_event: entry.next_event, action_state: entry.action_state };
}
/** Exact task allowlist only: never list boards or fetch titles, descriptions, comments or attachments. */
export async function collectAsana({ sourceId, projectId, entries, stageLabels, excludedAssigneeGids = [], credential, fetcher = fetch, now = new Date().toISOString(), onItemExcluded=()=>{} }) {
  identifier(sourceId); gid(projectId); requireThat(entries.length > 0 && entries.length <= 50 && new Set(entries.map(e=>e.target)).size === entries.length);
  requireThat(Array.isArray(excludedAssigneeGids) && excludedAssigneeGids.length <= 50 && new Set(excludedAssigneeGids).size === excludedAssigneeGids.length,'invalid_owner_filter');
  excludedAssigneeGids.forEach(gid);
  const items = [];
  try {
    for (const entry of entries) {
      definition(entry); gid(entry.target);
      const result = await jsonGet(fetcher, `https://app.asana.com/api/1.0/tasks/${entry.target}?opt_fields=${ASANA_FIELDS}`, { Authorization: 'Bearer ' + credential, Accept: 'application/json' });
      const task = result.data; requireThat(task?.gid === entry.target, 'source_conflict'); instant(task.modified_at);
      if (excludedAssigneeGids.length) {
        // Missing ownership is not the same as explicitly unassigned. Do not
        // silently include an excluded owner's task after a partial response.
        requireThat(task.assignee === null || task.assignee && typeof task.assignee.gid === 'string','source_conflict');
        if (task.assignee !== null) gid(task.assignee.gid);
        if (excludedAssigneeGids.includes(task.assignee?.gid)) {onItemExcluded({item_id:sourceId+':'+entry.target,source_id:sourceId,source_revision:task.modified_at,observed_at:now,reason:'excluded'});continue;}
      }
      const memberships = task.memberships?.filter(m => m.project?.gid === projectId);
      requireThat(memberships?.length === 1, 'source_conflict');
      const section = memberships[0].section?.gid;
      requireThat(typeof task.completed === 'boolean' && typeof stageLabels?.[section] === 'string', 'source_conflict');
      // Keep the source stage verbatim via the reviewed GID-to-label catalog. Never map to Hub's July taxonomy.
      const status = task.completed ? 'Completed' : stageLabels[section];
      if (task.completed && entry.kind !== 'project') {onItemExcluded({item_id:sourceId+':'+entry.target,source_id:sourceId,source_revision:task.modified_at,observed_at:now,reason:'resolved'});continue;}
      items.push(item(entry, sourceId, task.modified_at, `https://app.asana.com/0/${projectId}/${task.gid}`, status, task.due_at ?? task.due_on ?? null));
    }
    return validateFeed(feed(sourceId, 'asana', now, items), ['app.asana.com'], Date.parse(now));
  } catch (error) { return feed(sourceId, 'asana', now, [], code(error)); }
}
/** Exact PR allowlist. GitHub REST has no response field selector; prefer the host's gh GraphQL collector below. */
export function githubMetadataFeed({ sourceId, repository, entries, records, now }) {
  requireThat(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'invalid_target');
  requireThat(Array.isArray(entries) && entries.length > 0 && entries.length <= 50 && new Set(entries.map(e=>e.target)).size === entries.length, 'invalid_target');
  const items = [];
  for (const entry of entries) {
    definition(entry); requireThat(/^[1-9]\d*$/.test(entry.target), 'invalid_target');
    const record = records.find(r=> String(r.number) === entry.target); requireThat(record, 'source_unavailable');
    exact(record, ['number','state','isDraft','updatedAt']); instant(record.updatedAt);
    requireThat(['OPEN','CLOSED','MERGED'].includes(record.state) && typeof record.isDraft === 'boolean');
    if (record.state !== 'OPEN' && entry.kind !== 'project') continue;
    items.push(item(entry, sourceId, record.updatedAt, `https://github.com/${repository}/pull/${entry.target}`, record.state === 'OPEN' ? record.isDraft ? 'Draft pull request' : 'Open pull request' : record.state === 'MERGED' ? 'Merged' : 'Closed'));
  }
  return validateFeed(feed(sourceId, 'github', now, items), ['github.com'], Date.parse(now));
}
/** Claude owns sanitization/review BEFORE this input exists. No raw-source converter is provided. */
export function claudeExportFeed(value, { allowedHosts, now = Date.now() }) {
  requireThat(value?.system === 'claude', 'wrong_source'); return validateFeed(structuredClone(value), allowedHosts, now);
}
export function syncHealthFeed(health, { sourceId, sourceUrl, now }) {
  identifier(sourceId);
  // Drop all non-metric keys; never carry queue content, raw failure messages or filenames.
  const depth = health.actionable_queue_depth, oldest = health.oldest_queued_age_hours_approx;
  requireThat(typeof health.observed_at === 'string' && Number.isFinite(Date.parse(health.observed_at)), 'invalid_health');
  now = new Date(health.observed_at).toISOString();
  requireThat(Number.isInteger(depth) && depth >= 0 && (oldest === null || Number.isFinite(oldest) && oldest >= 0), 'invalid_health');
  requireThat(health.last_successful_sync_at === null || typeof health.last_successful_sync_at === 'string', 'invalid_health');
  if (health.last_successful_sync_at) requireThat(Number.isFinite(Date.parse(health.last_successful_sync_at)), 'invalid_health');
  requireThat(typeof health.stuck === 'boolean', 'invalid_health');
  const failed = Boolean(health.alert);
  const lastSuccess = health.last_successful_sync_at ? new Date(health.last_successful_sync_at).toISOString() : null;
  const items = depth > 0 || health.stuck || failed ? [{ item_id: sourceId + ':delivery', source_id: sourceId, source_revision: now, source_url: sourceUrl, spoken_name: 'Asana delivery', kind: 'agent', status: health.stuck ? 'Queue stuck' : failed ? 'Sync needs attention' : 'Queued updates', context: `${depth} actionable updates waiting. Oldest age: ${oldest === null ? 'unavailable' : Math.floor(oldest * 60) + ' minutes'}. Last successful delivery: ${lastSuccess ?? 'not recorded'}.`, recommendation: 'Review the existing sync receipt before retrying.', requires_steve: false, due: null, next_event: null, action_state: 'none' }] : [];
  return feed(sourceId, 'asana_sync', now, items);
}
