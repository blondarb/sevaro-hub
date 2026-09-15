// Host-owned attention history, not source-system task state. Only a verified
// publication can admit content; pending candidates and source exports cannot.
import {exact,requireThat,instant,identifier,validateItem,sha256,canonical,isTodayItem} from './context.mjs';
import {validateSnapshot,LINK_HOSTS} from './release.mjs';

const HASH=/^[a-f0-9]{64}$/;
const STATES=['active','dismissed','resolved','excluded','withheld'];
export const RETENTION_FILE='retained-attention.json';
export async function emptyRetention() {
  const body={schema_version:1,entries:[]};return {...body,digest:await sha256(body)};
}
export async function validateRetention(store) {
  exact(store,['schema_version','entries','digest']);
  requireThat(store.schema_version===1&&Array.isArray(store.entries)&&store.entries.length<=100,'invalid_retention');
  const {digest,...body}=store;requireThat(HASH.test(digest)&&digest===await sha256(body),'retention_digest_mismatch');
  const seen=new Set();
  for(const e of store.entries) {
    exact(e,['item','source_observed_at','review_expires_at','first_saved_at','published_at','publication_id','snapshot_digest','state','disposition']);
    validateItem(e.item,LINK_HOSTS);requireThat(!e.item.same_obligation_as,'invalid_retention');
    requireThat(!seen.has(e.item.item_id),'duplicate_retention');seen.add(e.item.item_id);
    for(const k of ['source_observed_at','review_expires_at','first_saved_at','published_at'])instant(e[k]);
    requireThat(instant(e.source_observed_at)<=instant(e.published_at)&&instant(e.first_saved_at)<=instant(e.published_at)&&instant(e.published_at)<instant(e.review_expires_at),'invalid_retention_time');
    identifier(e.publication_id);requireThat(HASH.test(e.snapshot_digest)&&STATES.includes(e.state),'invalid_retention');
    if(e.state==='active')requireThat(e.disposition===null,'invalid_disposition');
    else {
      exact(e.disposition,['decision','item_digest','decided_at','evidence_id']);
      requireThat(e.disposition.decision===e.state&&HASH.test(e.disposition.item_digest),'invalid_disposition');
      instant(e.disposition.decided_at);identifier(e.disposition.evidence_id);
      requireThat(e.disposition.item_digest===await sha256(e.item)&&instant(e.disposition.decided_at)>=instant(e.published_at),'invalid_disposition');
    }
  }
  return store;
}
async function sealed(entries) {
  const body={schema_version:1,entries:[...entries].sort((a,b)=>a.item.item_id.localeCompare(b.item.item_id))};
  return validateRetention({...body,digest:await sha256(body)});
}

/** verifyPublication is trusted host code checking the actual deployment/readback,
 * never a boolean from a JSON packet. A checksum alone cannot approve admission. */
export async function rememberPublication({store,snapshot,publication,verifyPublication,now=Date.now()}) {
  await validateRetention(store);
  exact(publication,['id','published_at','snapshot_digest']);identifier(publication.id);
  const published=instant(publication.published_at);
  requireThat(published<=now,'future_publication');
  await validateSnapshot(snapshot,published);
  requireThat(snapshot.classification==='executive-reviewed'&&publication.snapshot_digest===await sha256(snapshot),'published_review_required');
  requireThat(typeof verifyPublication==='function'&&await verifyPublication({snapshot:structuredClone(snapshot),publication:structuredClone(publication)})===true,'verified_publication_required');
  const entries=new Map(store.entries.map(e=>[e.item.item_id,structuredClone(e)]));
  for(const row of snapshot.items) {
    if(row.retention||!snapshot.today_item_ids.includes(row.item_id))continue;
    const {number,...item}=row,prior=entries.get(item.item_id);
    if(prior&&prior.state!=='active'&&!newEvidence(item,snapshot.health.find(h=>h.source_id===item.source_id),prior))continue;
    const observed=snapshot.health.find(h=>h.source_id===item.source_id)?.observed_at;
    if(prior) {
      requireThat(prior.item.source_id===item.source_id,'source_conflict');
      if(instant(observed)<instant(prior.source_observed_at))continue;
      if(instant(observed)===instant(prior.source_observed_at)) {
        requireThat(canonical(item)===canonical(prior.item),'source_conflict');
        continue; // Re-publication is not new source evidence or a new expiry.
      }
    }
    entries.set(item.item_id,{item,source_observed_at:observed,review_expires_at:snapshot.expires_at,
      first_saved_at:prior?.first_saved_at??publication.published_at,published_at:publication.published_at,
      publication_id:publication.id,snapshot_digest:publication.snapshot_digest,state:'active',disposition:null});
  }
  return sealed(entries.values());
}

/** Local attention dismissal is not an Asana completion or an email send.
 * Caller must verify the exact owner instruction / authoritative resolution. */
export async function disposeAttention({store,itemId,decision,itemDigest,evidenceId,decidedAt,verifyDisposition,now=Date.now()}) {
  await validateRetention(store);requireThat(['dismissed','resolved','excluded','withheld'].includes(decision),'invalid_disposition');
  const entries=structuredClone(store.entries),entry=entries.find(e=>e.item.item_id===itemId);
  requireThat(entry&&itemDigest===await sha256(entry.item),'disposition_item_changed');
  const disposition={decision,item_digest:itemDigest,decided_at:decidedAt,evidence_id:evidenceId};
  instant(decidedAt);identifier(evidenceId);requireThat(instant(decidedAt)<=now&&instant(decidedAt)>=instant(entry.published_at),'invalid_disposition');
  if(entry.state!=='active') {
    requireThat(canonical(entry.disposition)===canonical(disposition),'disposition_conflict');return store;
  }
  requireThat(typeof verifyDisposition==='function'&&await verifyDisposition({item:structuredClone(entry.item),disposition:structuredClone(disposition)})===true,'verified_disposition_required');
  entry.state=decision;entry.disposition=disposition;return sealed(entries);
}

// A later observation alone is not a reopened obligation. Non-security
// dispositions require a changed authoritative revision as well.
function newEvidence(item,health,entry) {
  return item&&!item.retention&&health&&['available','partial'].includes(health.state)
    &&instant(health.observed_at)>instant(entry.disposition.decided_at)
    &&(entry.state==='withheld'||item.source_revision!==entry.item.source_revision);
}

/** Carry only already-admitted attention. Omission is never a resolution. */
export async function carryAttention(snapshot,store,{allowedItem=()=>true,now=Date.now()}={}) {
  await validateRetention(store);await validateSnapshot(snapshot,now);
  const items=new Map(snapshot.items.map(i=>[i.item_id,structuredClone(i)]));
  for(const entry of store.entries) {
    const id=entry.item.item_id,health=snapshot.health.find(h=>h.source_id===entry.item.source_id);
    if(entry.state!=='active') {
      if(!newEvidence(items.get(id),health,entry))items.delete(id);
      continue; // Only fresh changed source content can be proposed again.
    }
    if(!health||!allowedItem(entry.item)||['permission_required','source_conflict'].includes(health.failure_code))continue;
    if(items.has(id))continue;
    const item=structuredClone(entry.item);
    // Retained evidence is part of the historical card, never fresh Asana evidence.
    delete item.evidence;
    items.set(id,{...item,action_state:'none',retention:{state:'historical-needs-recheck',
      source_observed_at:entry.source_observed_at,review_expires_at:entry.review_expires_at,
      snapshot_digest:entry.snapshot_digest}});
  }
  const rows=[...items.values()].sort((a,b)=>a.item_id.localeCompare(b.item_id)).map((i,n)=>({...i,number:n+1}));
  const {snapshot_id,view_id,...body}=snapshot;
  Object.assign(body,{schema_version:2,items:rows,today_item_ids:rows.filter(i=>i.retention||isTodayItem(i,now)).map(i=>i.item_id),requiring_steve:rows.filter(i=>i.requires_steve).length});
  const digest=await sha256(body);return validateSnapshot({...body,snapshot_id:'snapshot-'+digest,view_id:'today-'+digest},now);
}
