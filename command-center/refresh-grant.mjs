// The independently pinned grant is protected deployment configuration, never
// accepted from a page, source feed or user-generated item. Hashes are not signatures.
import {exact,requireThat,instant,sha256} from './context.mjs';
const CONSTRAINTS=['no PHI, raw bodies or transcripts','preserve source observation and expiry','review content before each release','exact snapshot digest and expiry bound receipt per release','no source writes, sends, assignments, stage decisions or automatic merge','owner-only audience unchanged'];
export async function validateRefreshGrant(authorization,anchor,now) {
  exact(anchor,['authorization_digest','site_project_id','saved_version_id']);
  exact(authorization,['schema_version','approved_by','approved_at','expires_at','site_project_id','scope','sources','constraints','remaining_access_limits','credential_exception','automatic_refresh_installed','credential_exception_consumed','refresh_mechanism','automatic_refresh_note']);
  requireThat(anchor.authorization_digest===await sha256(authorization),'refresh_grant_changed');
  requireThat(authorization.schema_version===1 && authorization.approved_by==='Steve' && authorization.scope==='reviewed-executive-metadata-owner-only-read-only-refresh','refresh_authorization_required');
  requireThat(authorization.site_project_id===anchor.site_project_id && /^appgprj_[a-zA-Z0-9]+$/.test(anchor.site_project_id) && typeof anchor.saved_version_id==='string' && anchor.saved_version_id.startsWith(anchor.site_project_id+'~appgver_') && /^appgprj_[a-zA-Z0-9]+~appgver_[a-zA-Z0-9]+$/.test(anchor.saved_version_id),'refresh_destination_mismatch');
  requireThat(instant(authorization.approved_at)<=now && instant(authorization.expires_at)>now && instant(authorization.expires_at)>instant(authorization.approved_at),'refresh_authorization_expired');
  requireThat(authorization.credential_exception_consumed===true && authorization.automatic_refresh_installed===false,'refresh_execution_scope_changed');
  requireThat(Array.isArray(authorization.constraints) && authorization.constraints.length===CONSTRAINTS.length && new Set(authorization.constraints).size===CONSTRAINTS.length && CONSTRAINTS.every(c=>authorization.constraints.includes(c)),'refresh_constraints_changed');
  requireThat(Array.isArray(authorization.sources) && authorization.sources.length>0 && authorization.sources.length<=50 && authorization.sources.every(s=>typeof s==='string') && new Set(authorization.sources).size===authorization.sources.length,'refresh_source_not_authorized');
}
export function requireAllRefreshSources(snapshot,authorization) {
  requireThat(snapshot.health.length===authorization.sources.length && snapshot.health.every(h=>authorization.sources.includes(h.source_id)),'refresh_source_not_authorized');
}
export async function validateDerivedRefresh(snapshot,receipt,grant,now) {
  exact(grant,['authorization','anchor']);
  await validateRefreshGrant(grant.authorization,grant.anchor,now);
  const auth=grant.authorization,anchor=grant.anchor;
  exact(receipt,['schema_version','kind','authorization_digest','authorized_by','authorized_at','bound_at','expires_at','site_project_id','saved_version_id','candidate_digest','candidate_expires_at','reviewed_by','reviewed_at','policy','release_digest']);
  requireThat(receipt.schema_version===1 && receipt.kind==='policy-derived-refresh' && receipt.authorized_by==='Steve' && receipt.authorized_at===auth.approved_at && receipt.authorization_digest===anchor.authorization_digest && receipt.site_project_id===anchor.site_project_id && receipt.saved_version_id===anchor.saved_version_id,'refresh_authorization_required');
  requireAllRefreshSources(snapshot,auth);
  requireThat(receipt.release_digest===await sha256(snapshot) && receipt.reviewed_by==='Codex' && receipt.policy==='executive-project-context-v1','refresh_content_review_required');
  requireThat(instant(receipt.reviewed_at)>=instant(snapshot.generated_at) && instant(receipt.reviewed_at)>=instant(auth.approved_at) && instant(receipt.reviewed_at)<=instant(receipt.bound_at) && instant(receipt.bound_at)<=now,'refresh_content_review_required');
  requireThat(instant(receipt.expires_at)===instant(snapshot.expires_at) && instant(receipt.expires_at)>now && instant(receipt.expires_at)===Math.min(instant(receipt.candidate_expires_at),instant(auth.expires_at)),'refresh_authorization_expired');
  // Reconstruct the exact pending candidate before classification/cutoff changes.
  const {snapshot_id,view_id,...body}=snapshot;
  body.classification='executive-pending-review';body.expires_at=receipt.candidate_expires_at;
  requireThat(instant(body.expires_at)>instant(body.generated_at) && instant(body.expires_at)-instant(body.generated_at)<=7200000,'snapshot_expired');
  const hash=await sha256(body),candidate={...body,snapshot_id:'snapshot-'+hash,view_id:'today-'+hash};
  requireThat(receipt.candidate_digest===await sha256(candidate),'refresh_content_review_required');
}
