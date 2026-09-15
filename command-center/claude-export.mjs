// Host-only boundary for Claude's curated outputs. This is review provenance,
// not a PHI detector, a signature, or Steve's authorization to publish content.
import {exact,requireThat,identifier,instant,sha256,validateFeed} from './context.mjs';
import {isCommunicationSourceUrl} from './source-links.mjs';
export const CLAUDE_EXPORT_POLICY = 'executive-project-context-v1';
export async function reviewedClaudeExport(packet,{allowedHosts,now=Date.now()}) {
  exact(packet,['schema_version','feed','review','run']);
  requireThat(packet.schema_version !== 1,'export_re_review_required');
  requireThat(packet.schema_version===2 && packet.feed?.system==='claude','invalid_claude_export');
  const feed=validateFeed(structuredClone(packet.feed),allowedHosts,now);
  exact(packet.review,['reviewed_by','reviewed_at','policy','feed_digest','packet_digest']);
  const review=packet.review;
  exact(packet.run,['run_id','routine','started_at','completed_at','outcome','coverage']);
  const run=packet.run; identifier(run.run_id); identifier(run.routine);
  requireThat(instant(run.started_at)<=instant(run.completed_at) && instant(feed.observed_at)<=instant(run.completed_at) && instant(run.completed_at)<=instant(review.reviewed_at),'invalid_run_receipt');
  requireThat(['succeeded','partial','failed'].includes(run.outcome) && ['reviewed-sources-only','complete-allowlist','unavailable'].includes(run.coverage),'invalid_run_receipt');
  requireThat(feed.status!=='available' || run.outcome!=='failed' && run.coverage!=='unavailable','invalid_run_receipt');
  requireThat(run.outcome!=='failed' || feed.status==='unavailable','invalid_run_receipt');
  requireThat(({succeeded:'complete-allowlist',partial:'reviewed-sources-only',failed:'unavailable'})[run.outcome]===run.coverage,'invalid_run_receipt');
  requireThat(run.outcome !== 'succeeded' || feed.status === 'available','invalid_run_receipt');
  requireThat(run.outcome !== 'partial' || ['available','partial'].includes(feed.status),'invalid_run_receipt');
  requireThat(review.reviewed_by==='Claude' && review.policy===CLAUDE_EXPORT_POLICY && review.feed_digest===await sha256(feed) && review.packet_digest===await sha256({feed,run}),'export_review_required');
  requireThat(instant(review.reviewed_at)>=instant(feed.observed_at) && instant(review.reviewed_at)<=now+60_000,'invalid_review_time');
  requireThat(feed.source_id !== 'claude:replies' || feed.items.every(item=>isCommunicationSourceUrl(item.source_url,allowedHosts)), 'communication_source_required');
  // Preserve actual source observation/expiry, never replace it with export or file mtime.
  return {feed,receipt:{source_id:feed.source_id,...structuredClone(run),reviewed_at:review.reviewed_at,feed_digest:review.feed_digest,packet_digest:review.packet_digest}};
}
export function importableClaudeFeed({feed,receipt}) {
  if (feed.status === 'unavailable') return feed;
  // A later review must not make an old communication obligation current. This
  // only tightens a verified producer expiry; the original envelope stays intact.
  const normalized = feed.source_id === 'claude:replies'
    ? {...feed, expires_at:new Date(Math.min(instant(feed.expires_at),instant(feed.observed_at)+2*3600_000)).toISOString()}
    : feed;
  if (receipt.outcome === 'succeeded' && receipt.coverage === 'complete-allowlist') return normalized;
  requireThat(receipt.outcome === 'partial' && receipt.coverage === 'reviewed-sources-only','incomplete_claude_coverage');
  // Coverage is a closed run-receipt enum. Preserve it as a distinct source
  // state so reviewed items never imply that the full allowlist was covered.
  return {...normalized, status:'partial'};
}
export function claudeExportSummary(reviewed, now=Date.now()) {
  const feed=importableClaudeFeed(reviewed),receipt=reviewed.receipt;
  const fresh=instant(feed.expires_at)>now;
  return {valid:true,importable:true,fresh,usable_for_snapshot:fresh && ['available','partial'].includes(feed.status),source_state:feed.status,source_id:feed.source_id,item_count:feed.items.length,source_observed_at:feed.observed_at,source_expires_at:reviewed.feed.expires_at,effective_expires_at:feed.expires_at,outcome:receipt.outcome,coverage:receipt.coverage,requires_steve_approval:true};
}
