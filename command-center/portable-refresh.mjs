// Offline preparation for an already authenticated collector/reviewer. No source
// access, scheduler, provider credentials, approval UI or publisher lives here.
import {assemble,exact,requireThat,canonical,sha256} from './context.mjs';
import {LINK_HOSTS,loadRuntimeSnapshot,snapshotBindings} from './release.mjs';
import {validateRefreshGrant} from './refresh-grant.mjs';
import {reviewedClaudeExport,importableClaudeFeed} from './claude-export.mjs';
import {bindReviewedRefresh} from './refresh-authorization.mjs';

const SYSTEMS=Object.freeze({'asana:portfolio':'asana','github:hub':'github','asana_sync:delivery':'asana_sync','claude:coordination':'claude','claude:replies':'claude','claude:calendar':'claude','claude:meetings':'claude','claude:module-review':'claude'});
export async function checkedGrant(grant,pinnedAnchor,now=Date.now()) {
  exact(grant,['authorization','anchor']);
  requireThat(canonical(grant.anchor)===canonical(pinnedAnchor),'refresh_anchor_changed');
  await validateRefreshGrant(grant.authorization,pinnedAnchor,now);
  requireThat(grant.authorization.sources.every(s=>Object.hasOwn(SYSTEMS,s)),'refresh_source_not_authorized');
}

export async function preparePortableRefresh(input,grant,pinnedAnchor,now=Date.now(),{verifyClaudeOrigin}={}) {
  await checkedGrant(grant,pinnedAnchor,now);
  exact(input,['schema_version','feeds','claude_exports']);
  requireThat(input.schema_version===1 && Array.isArray(input.feeds) && input.feeds.length<=3 && Array.isArray(input.claude_exports) && input.claude_exports.length<=5,'invalid_portable_input');
  const feeds=structuredClone(input.feeds);
  for(const f of feeds)requireThat(SYSTEMS[f.source_id]===f.system && f.system!=='claude','reviewed_claude_packet_required');
  for(const packet of input.claude_exports) {
    const reviewed=await reviewedClaudeExport(packet,{allowedHosts:LINK_HOSTS,now});
    requireThat(SYSTEMS[reviewed.feed.source_id]==='claude','refresh_source_not_authorized');
    // Hashes and reviewed_by do not authenticate a producer. Only trusted caller
    // code may verify origin using its authenticated connector context. Neither
    // the input bundle nor this CLI can supply/enable that capability.
    requireThat(typeof verifyClaudeOrigin==='function' && await verifyClaudeOrigin(reviewed.receipt)===true,'authenticated_claude_delivery_required');
    feeds.push(importableClaudeFeed(reviewed));
  }
  // Missing sources stay visible as unavailable; stale/partial provenance is
  // preserved. Expected coverage comes from the pinned grant, never the packet.
  return assemble(feeds,{expectedSources:grant.authorization.sources,allowedHosts:LINK_HOSTS,now,ttlMs:7200000,classification:'executive-pending-review',includePortfolio:true});
}

export async function bindPortableRefresh(candidate,review,grant,pinnedAnchor,now=Date.now()) {
  await checkedGrant(grant,pinnedAnchor,now);
  // A digest-valid candidate can be constructed without running prepare. This
  // standalone binding lane has no connector-origin verifier, so it cannot
  // accept active Claude coverage (including evidence collapsed into Asana).
  requireThat(Array.isArray(candidate?.health),'invalid_context');
  requireThat(!candidate.health.some(h=>h.source_id?.startsWith('claude:') && ['available','partial'].includes(h.state)),'authenticated_claude_delivery_required');
  const bound=await bindReviewedRefresh({authorization:grant.authorization,anchor:pinnedAnchor,candidate,review,siteProjectId:pinnedAnchor.site_project_id,savedVersionId:pinnedAnchor.saved_version_id,now});
  const values={...snapshotBindings(bound.release.payload),CONTEXT_SOURCE_MODE:'runtime',CONTEXT_REAL_DATA_ENABLED:'approved',CONTEXT_RELEASE_SHA256:bound.release.digest,CONTEXT_REFRESH_GRANT:JSON.stringify(bound.grant),CONTEXT_REFRESH_RECEIPT:JSON.stringify(bound.receipt),CONTEXT_APPROVAL_RECEIPT:'',CONTEXT_SNAPSHOT:''};
  // Blank every unused transport slot, including previously larger snapshots.
  for(let i=0;i<16;i++)values['CONTEXT_SNAPSHOT_CHUNK_'+i]??='';
  await loadRuntimeSnapshot(values,now);
  // No owner setting, action catalog or delivery flag is emitted. A publisher
  // preserves those independently and uses only the exact pinned saved version.
  return {...bound,runtime_values:values};
}
export async function portableSummary(command,result) {
  const snapshot=command==='prepare'?result:result.snapshot;
  return {state:command==='prepare'?'review_required':'bound_not_published',snapshot_id:snapshot.snapshot_id,digest:await sha256(snapshot),expires_at:snapshot.expires_at,items:snapshot.items.length,published:false};
}
