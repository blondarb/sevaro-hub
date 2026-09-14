import {exact,requireThat,ContextError,sha256,identifier,instant} from '../command-center/context.mjs';
import {loadApprovalCatalog} from '../command-center/approvals.mjs';
import {ApprovalStore} from './approval-store.mjs';
import {DeliveryStore,deliveryLabel} from './delivery-store.mjs';
import {boundedBody} from './request-body.mjs';
const HASH=/^[a-f0-9]{64}$/;
const hash=v=>requireThat(HASH.test(v ?? ''),'invalid_delivery_reference');
const revision=v=>requireThat(Number.isSafeInteger(v)&&v>=0,'invalid_delivery_revision');
export function deliveryCapabilities(env) {
  return {mode:'owner-session-supervised',unattended:false,
    enabled:env.DELIVERY_SUPERVISION_ENABLED==='true',
    executors:{'claude-communications':env.CLAUDE_DELIVERY_READY==='true','asana-single-writer':env.ASANA_SINGLE_WRITER_READY==='true'}};
}
export async function deliveryApi(request,env,viewer,respond) {
  try {
    const url=new URL(request.url),owner=await sha256({site_owner:viewer}),now=Date.now();
    const capabilities=deliveryCapabilities(env),store=new DeliveryStore(env.DB),approvals=new ApprovalStore(env.DB);
    const paths=['/api/delivery/history','/api/delivery/claim','/api/delivery/start','/api/delivery/outcome'];
    requireThat(paths.includes(url.pathname),'invalid_delivery_request');
    requireThat(request.method===(url.pathname.endsWith('/history')?'GET':'POST'),'method_not_allowed');
    const cursor=url.searchParams.get('cursor');
    requireThat(!url.search || (url.pathname.endsWith('/history')&&[...url.searchParams.keys()].length===1&&HASH.test(cursor ?? '')),'invalid_delivery_request');
    if(request.method==='GET') {
      const result=await store.history(owner,cursor);
      const receipts=result.receipts.map(({approval_decision,...r})=>({...r,label:deliveryLabel({decision:approval_decision},r,now)}));
      return respond({...result,receipts,capabilities});
    }
    requireThat(request.headers.get('origin')===url.origin && request.headers.get('x-command-approval')==='exact-proposals-v1' && [null,'same-origin'].includes(request.headers.get('sec-fetch-site')),'origin_required');
    const body=await boundedBody(request);hash(body.proposal_digest);revision(body.expected_revision);
    const prior=await store.latest(owner,body.proposal_digest);
    if(url.pathname.endsWith('/outcome')) {
      exact(body,['proposal_digest','attempt_id','expected_revision','state','provider_ref','readback_digest','reason_code']);hash(body.attempt_id);
      requireThat(prior?.attempt_id===body.attempt_id,'delivery_attempt_changed');
      requireThat(['succeeded','failed_definitive','stale','unknown'].includes(body.state),'invalid_delivery_outcome');
      requireThat([null,'provider_rejected','source_changed','transport_uncertain','readback_missing','executor_unavailable'].includes(body.reason_code),'invalid_delivery_reason');
      // Retries of the same receipt are harmless, including response loss.
      if(prior.state===body.state && prior.provider_ref===body.provider_ref && prior.readback_digest===body.readback_digest && prior.reason_code===body.reason_code) return respond({receipt:prior,capabilities});
      if(body.state==='succeeded') {
        requireThat(['dispatch_started','unknown','succeeded'].includes(prior.state),'dispatch_not_started');
        requireThat(typeof body.provider_ref==='string' && /^[A-Za-z0-9_.:@/-]{1,200}$/.test(body.provider_ref),'provider_receipt_required');hash(body.readback_digest);
        requireThat(body.reason_code===null,'invalid_delivery_reason');
      } else {
        requireThat(body.provider_ref===null && body.readback_digest===null && body.reason_code!==null,'invalid_delivery_outcome');
        if(body.state==='unknown') requireThat(['dispatch_started','unknown'].includes(prior.state) && ['transport_uncertain','readback_missing'].includes(body.reason_code),'dispatch_not_started');
        else if(body.state==='stale') requireThat(prior.state==='claimed'&&body.reason_code==='source_changed','delivery_outcome_conflict');
        else requireThat(['claimed','dispatch_started'].includes(prior.state)&&['provider_rejected','executor_unavailable'].includes(body.reason_code),'delivery_outcome_conflict');
      }
      requireThat(prior.revision===body.expected_revision && !['succeeded','failed_definitive','stale'].includes(prior.state),'delivery_outcome_conflict');
      const receipt=await store.append({...prior,state:body.state,provider_ref:body.provider_ref,readback_digest:body.readback_digest,reason_code:body.reason_code},prior.revision,{now});
      return respond({receipt,capabilities});
    }
    requireThat(capabilities.enabled,'delivery_supervision_disabled');
    const {catalog,digest}=await loadApprovalCatalog(env,now);
    requireThat(catalog && digest===body.catalog_digest,'catalog_changed');
    const p=catalog.proposals.find(p=>p.digest===body.proposal_digest);requireThat(p,'proposal_changed');
    requireThat(capabilities.executors[p.executor],'executor_not_ready');
    // Synthetic records can exercise this protocol but MUST never reach providers.
    if(catalog.classification==='executive-reviewed'&&p.executor==='asana-single-writer')hash(p.source_revision);
    const approval=await approvals.latest(p.digest,owner);
    requireThat(approval?.decision==='approve'&&approval.revision===body.approval_revision&&approval.catalog_digest===digest&&instant(approval.expires_at)>now,'current_approval_required');
    if(url.pathname.endsWith('/claim')) {
      exact(body,['catalog_digest','proposal_digest','approval_revision','expected_revision','supervisor_run_id']);identifier(body.supervisor_run_id);
      if(prior?.state==='claimed'&&prior.supervisor_run_id===body.supervisor_run_id&&instant(prior.lease_expires_at)>now) return respond({receipt:prior,classification:catalog.classification,capabilities});
      requireThat(!prior || (prior.state==='claimed'&&instant(prior.lease_expires_at)<=now),'delivery_already_reserved_or_dispatched');
      requireThat((prior?.revision??0)===body.expected_revision,'delivery_revision_changed');
      const attempt=await sha256({owner,proposal:p.digest,revision:body.expected_revision+1,run:body.supervisor_run_id});
      const receipt=await store.append({owner_id:owner,proposal_digest:p.digest,proposal_id:p.proposal_id,catalog_digest:digest,approval_revision:approval.revision,attempt_id:attempt,supervisor_run_id:body.supervisor_run_id,executor:p.executor,state:'claimed',lease_expires_at:new Date(Math.min(now+120000,instant(catalog.expires_at))).toISOString(),provider_ref:null,readback_digest:null,reason_code:null,source_revision:p.source_revision,destination_digest:await sha256({source_url:p.source_url,executor:p.executor,payload:p.payload})},body.expected_revision,{requireApproval:true,now});
      return respond({receipt,classification:catalog.classification,capabilities});
    }
    exact(body,['catalog_digest','proposal_digest','approval_revision','expected_revision','attempt_id','preflight']);hash(body.attempt_id);
    exact(body.preflight,['source_revision','checked_at','destination_digest']);hash(body.preflight.destination_digest);
    requireThat(prior?.attempt_id===body.attempt_id,'delivery_attempt_changed');
    // A start response lost in transit must be reconciled, NEVER returned as a new permit.
    requireThat(prior.state==='claimed'&&prior.revision===body.expected_revision,'dispatch_already_started_or_changed');
    requireThat(instant(prior.lease_expires_at)>now,'delivery_lease_expired');
    requireThat(body.preflight.source_revision===p.source_revision && instant(body.preflight.checked_at)>=instant(prior.recorded_at) && instant(body.preflight.checked_at)<=now && now-instant(body.preflight.checked_at)<=30000 && body.preflight.destination_digest===await sha256({source_url:p.source_url,executor:p.executor,payload:p.payload}),'provider_preflight_required');
    const receipt=await store.append({...prior,state:'dispatch_started',lease_expires_at:new Date(Math.min(now+30000,instant(catalog.expires_at))).toISOString()},prior.revision,{requireApproval:true,now});
    return respond({receipt,classification:catalog.classification,capabilities,dispatch_before:receipt.lease_expires_at});
  } catch(error) {
    const code=error instanceof ContextError?error.code:'delivery_save_uncertain';
    return respond({error:code},code==='origin_required'?403:code==='method_not_allowed'?405:code==='request_too_large'?413:409);
  }
}
