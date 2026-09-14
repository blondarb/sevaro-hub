// Operational delivery evidence only. Provider calls stay with existing executors.
import { requireThat, sha256 } from '../command-center/context.mjs';
export const DELIVERY_STATES = ['claimed','dispatch_started','succeeded','failed_definitive','stale','unknown'];
export function deliveryLabel(approval, delivery, now = Date.now()) {
  if (!delivery) return null;
  if (delivery.state === 'succeeded') return 'Executor reported success — readback not independently verified';
  if (['dispatch_started','unknown'].includes(delivery.state)) {
    if (approval?.decision === 'revoke') return 'Withdrawal requested — delivery may have started';
    return delivery.state === 'unknown' ? 'Delivery uncertain — reconciliation required' : 'Delivery started — confirmation required';
  }
  if (approval?.decision === 'revoke') return delivery.state==='failed_definitive' ? 'Approval withdrawn — delivery failed; completion not confirmed' : 'Approval withdrawn — not dispatched';
  if (delivery.state === 'claimed') return Date.parse(delivery.lease_expires_at) <= now ? 'Delivery reservation expired — not dispatched' : 'Delivery reserved — checking source';
  return delivery.state === 'stale' ? 'Source changed — new review needed' : 'Delivery failed — new review needed';
}
export class DeliveryStore {
  constructor(db) {
    requireThat(db && typeof db.prepare === 'function','delivery_storage_unavailable');
    this.db = db;
  }
  latest(owner,digest) {
    return this.db.prepare('SELECT * FROM delivery_events WHERE owner_id=? AND proposal_digest=? ORDER BY revision DESC LIMIT 1').bind(owner,digest).first();
  }
  async history(owner,cursor=null) {
    const after = cursor ? await this.db.prepare('SELECT recorded_at,event_id FROM delivery_events WHERE owner_id=? AND event_id=?').bind(owner,cursor).first() : null;
    requireThat(!cursor || after,'invalid_history_cursor');
    const result = await this.db.prepare('SELECT e.*,a.decision AS approval_decision FROM delivery_events e LEFT JOIN approval_events a ON a.owner_id=e.owner_id AND a.proposal_digest=e.proposal_digest AND a.revision=(SELECT MAX(revision) FROM approval_events WHERE owner_id=e.owner_id AND proposal_digest=e.proposal_digest) WHERE e.owner_id=? AND e.revision=(SELECT MAX(revision) FROM delivery_events WHERE owner_id=e.owner_id AND proposal_digest=e.proposal_digest) AND (e.recorded_at<? OR (e.recorded_at=? AND e.event_id<?)) ORDER BY e.recorded_at DESC,e.event_id DESC LIMIT 101').bind(owner,after?.recorded_at ?? '9999-12-31',after?.recorded_at ?? '9999-12-31',after?.event_id ?? 'f'.repeat(64)).all();
    return {receipts:result.results.slice(0,100),next_cursor:result.results.length>100?result.results[99].event_id:null};
  }
  async append(row,expectedRevision,{requireApproval=false,now=Date.now()}={}) {
    const value = {...row,revision:expectedRevision+1,recorded_at:new Date(now).toISOString(),recorded_via:'owner-session-supervisor'};
    value.event_id = await sha256(value);
    const keys=['event_id','owner_id','proposal_digest','proposal_id','catalog_digest','approval_revision','revision','attempt_id','supervisor_run_id','executor','state','recorded_at','lease_expires_at','provider_ref','readback_digest','reason_code','source_revision','recorded_via','destination_digest'];
    // Both delivery CAS and approval/revocation check occur in ONE SQLite statement.
    const result = await this.db.prepare(`INSERT INTO delivery_events (${keys.join(',')}) SELECT ${keys.map(()=>'?').join(',')} WHERE ?=COALESCE((SELECT MAX(revision) FROM delivery_events WHERE owner_id=? AND proposal_digest=?),0) AND (?=0 OR EXISTS(SELECT 1 FROM approval_events a WHERE a.owner_id=? AND a.proposal_digest=? AND a.revision=? AND a.catalog_digest=? AND a.decision='approve' AND a.expires_at>? AND a.revision=(SELECT MAX(revision) FROM approval_events WHERE owner_id=a.owner_id AND proposal_digest=a.proposal_digest))) RETURNING *`).bind(...keys.map(k=>value[k]),expectedRevision,value.owner_id,value.proposal_digest,requireApproval?1:0,value.owner_id,value.proposal_digest,value.approval_revision,value.catalog_digest,value.recorded_at).first();
    if (result) return result;
    const prior=await this.latest(value.owner_id,value.proposal_digest);
    requireThat(prior?.event_id===value.event_id,'delivery_conflict_or_approval_changed');
    return prior;
  }
}
