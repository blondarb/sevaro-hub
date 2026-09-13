// Host-only boundary for Claude's curated outputs. This is review provenance,
// not a PHI detector, a signature, or Steve's authorization to publish content.
import {exact,requireThat,identifier,instant,sha256,validateFeed} from './context.mjs';
export const CLAUDE_EXPORT_POLICY = 'executive-project-context-v1';
export async function reviewedClaudeExport(packet,{allowedHosts,now=Date.now()}) {
  exact(packet,['schema_version','feed','review','run']);
  requireThat(packet.schema_version===1 && packet.feed?.system==='claude','invalid_claude_export');
  const feed=validateFeed(structuredClone(packet.feed),allowedHosts,now);
  exact(packet.review,['reviewed_by','reviewed_at','policy','feed_digest']);
  const review=packet.review;
  requireThat(review.reviewed_by==='Claude' && review.policy===CLAUDE_EXPORT_POLICY && review.feed_digest===await sha256(feed),'export_review_required');
  requireThat(instant(review.reviewed_at)>=instant(feed.observed_at) && instant(review.reviewed_at)<=now+60_000,'invalid_review_time');
  exact(packet.run,['run_id','routine','started_at','completed_at','outcome','coverage']);
  const run=packet.run; identifier(run.run_id); identifier(run.routine);
  requireThat(instant(run.started_at)<=instant(run.completed_at) && instant(feed.observed_at)<=instant(run.completed_at) && instant(run.completed_at)<=instant(review.reviewed_at),'invalid_run_receipt');
  requireThat(['succeeded','partial','failed'].includes(run.outcome) && ['reviewed-sources-only','complete-allowlist','unavailable'].includes(run.coverage),'invalid_run_receipt');
  requireThat(feed.status!=='available' || run.outcome!=='failed' && run.coverage!=='unavailable','invalid_run_receipt');
  requireThat(run.outcome!=='failed' || feed.status==='unavailable','invalid_run_receipt');
  requireThat(({succeeded:'complete-allowlist',partial:'reviewed-sources-only',failed:'unavailable'})[run.outcome]===run.coverage,'invalid_run_receipt');
  // Preserve actual source observation/expiry, never replace it with export or file mtime.
  return {feed,receipt:{source_id:feed.source_id,...structuredClone(run),reviewed_at:review.reviewed_at,feed_digest:review.feed_digest}};
}
// The current Site schema cannot represent partial coverage. Keep that reviewed
// packet for reconciliation; never flatten it into a complete available source.
export function importableClaudeFeed({feed,receipt}) {
  requireThat(feed.status==='unavailable' || receipt.outcome==='succeeded' && receipt.coverage==='complete-allowlist','incomplete_claude_coverage');
  return feed;
}
