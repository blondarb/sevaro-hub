// Host-only worklist for Claude's existing communications owner. This is neither
// a live feed nor evidence that a historical message remains unanswered.
import {exact, requireThat, identifier, instant, sha256} from './context.mjs';
import {reviewedClaudeExport} from './claude-export.mjs';
import {isCommunicationSourceUrl} from './source-links.mjs';

const PURPOSE = 'historical-references-for-source-recheck';
const ROUTINES = ['comms-morning-briefing', 'comms-afternoon-check'];
const MAX = 100;
const fields = ['item_id','source_url','source_revision','first_observed_at','last_observed_at','packet_digest','run_id','item_digest'];
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export async function prepareReplyRecheck(packets, {allowedHosts, now=Date.now(), prior=null,verifySourceReference}={}) {
  requireThat(Array.isArray(packets) && packets.length > 0 && packets.length <= MAX, 'invalid_recheck_inputs');
  const refs = new Map();
  const runs = new Map(), observations = new Map();
  if (prior) {
    exact(prior, ['schema_version','purpose','generated_at','source_id','references','digest']);
    const {digest,...body} = prior;
    requireThat(prior.schema_version===2 && prior.purpose===PURPOSE && prior.source_id==='claude:replies' &&
      hash(digest) && digest===await sha256(body) && instant(prior.generated_at)<=now, 'invalid_recheck_plan');
    requireThat(Array.isArray(prior.references) && prior.references.length<=MAX, 'invalid_recheck_plan');
    for (const ref of prior.references) {
      exact(ref,fields); identifier(ref.item_id); identifier(ref.run_id);
      requireThat(typeof ref.source_revision==='string' && ref.source_revision.length>0 && ref.source_revision.length<=100 &&
        hash(ref.packet_digest) && hash(ref.item_digest) && isCommunicationSourceUrl(ref.source_url,allowedHosts) &&
        instant(ref.first_observed_at)<=instant(ref.last_observed_at) && instant(ref.last_observed_at)<=instant(prior.generated_at) &&
        !refs.has(ref.item_id), 'invalid_recheck_plan');
      refs.set(ref.item_id, structuredClone(ref));
      for (const [map,key] of [[runs,ref.run_id],[observations,instant(ref.last_observed_at)]]) {
        requireThat(!map.has(key) || map.get(key)===ref.packet_digest,'source_conflict');
        map.set(key,ref.packet_digest);
      }
    }
  }
  const reviewed = [];
  for (const packet of packets) {
    // Expired V2 packets may supply historical references only. Existing strict
    // review validation still applies; V1, malformed and unreviewed inputs fail.
    const result = await reviewedClaudeExport(packet,{allowedHosts,now});
    const {feed,receipt} = result;
    // Unlike a live collector's clock-skew allowance, this historical plan may
    // only carry evidence already observed/reviewed when it was generated.
    requireThat(instant(feed.observed_at)<=now && instant(receipt.reviewed_at)<=now,'future_recheck_evidence');
    requireThat(feed.source_id==='claude:replies' && ROUTINES.includes(receipt.routine.replace(/^routine:/,'')), 'wrong_recheck_source');
    for (const [map,key] of [[runs,receipt.run_id],[observations,instant(feed.observed_at)]]) {
      requireThat(!map.has(key) || map.get(key)===receipt.packet_digest, 'source_conflict');
      map.set(key,receipt.packet_digest);
    }
    reviewed.push(result);
  }
  reviewed.sort((a,b)=>instant(a.feed.observed_at)-instant(b.feed.observed_at));
  for (const {feed,receipt} of reviewed) {
    for (const item of feed.items) {
      const previous=refs.get(item.item_id);
      const ref={item_id:item.item_id,source_url:item.source_url,source_revision:item.source_revision,
        first_observed_at:feed.observed_at,last_observed_at:feed.observed_at,packet_digest:receipt.packet_digest,run_id:receipt.run_id,item_digest:await sha256(item)};
      if (previous) {
        if (instant(previous.last_observed_at)===instant(feed.observed_at))
          requireThat(previous.packet_digest===receipt.packet_digest, 'source_conflict');
        // Preserve the source's exact timestamp spelling on an exact replay.
        ref.first_observed_at=instant(previous.first_observed_at)<=instant(feed.observed_at)
          ? previous.first_observed_at : feed.observed_at;
        if (instant(previous.last_observed_at)>instant(feed.observed_at)) Object.assign(ref,previous,{first_observed_at:ref.first_observed_at});
      }
      // Omission, empty/partial checks and expired packets never close an item.
      refs.set(item.item_id,ref);
      requireThat(refs.size<=MAX,'recheck_limit_exceeded');
    }
  }
  // Source shape and packet hashes cannot authenticate claims. The trusted host
  // must independently match each exact item/packet/link to reviewed source
  // evidence. Recheck retained references too: a prior plan is not authority.
  // There is deliberately no JSON flag/manifest or standalone CLI bypass.
  for (const ref of refs.values()) {
    requireThat(typeof verifySourceReference==='function' &&
      await verifySourceReference(Object.freeze(structuredClone(ref)))===true, 'independent_source_verification_required');
  }
  const body={schema_version:2,purpose:PURPOSE,generated_at:new Date(now).toISOString(),source_id:'claude:replies',
    references:[...refs.values()].sort((a,b)=>a.item_id<b.item_id?-1:a.item_id>b.item_id?1:0)};
  return {...body,digest:await sha256(body)};
}

export function recheckSummary(plan) {
  return {purpose:PURPOSE,reference_count:plan.references.length,digest:plan.digest,
    source_recheck_required:true,inbox_coverage_verified:false,publishable:false};
}
