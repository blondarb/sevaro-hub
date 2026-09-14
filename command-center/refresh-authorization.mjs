// Host-only binding after an actual review. Never generates Steve consent,
// publishes, authenticates or changes a protected deployment anchor.
import {exact,requireThat,instant,sha256} from './context.mjs';
import {validateSnapshot,prepareRelease} from './release.mjs';
import {validateRefreshGrant,requireAllRefreshSources,validateDerivedRefresh} from './refresh-grant.mjs';
export async function bindReviewedRefresh({authorization,anchor,candidate,review,siteProjectId,savedVersionId,now=Date.now()}) {
  await validateRefreshGrant(authorization,anchor,now);
  requireThat(siteProjectId===anchor.site_project_id && savedVersionId===anchor.saved_version_id,'refresh_destination_mismatch');
  await validateSnapshot(candidate,now);
  requireThat(candidate.classification==='executive-pending-review','pending_review_required');
  requireAllRefreshSources(candidate,authorization);
  exact(review,['candidate_digest','reviewed_by','reviewed_at','policy']);
  requireThat(review.candidate_digest===await sha256(candidate),'refresh_content_review_required');
  const {snapshot_id,view_id,...body}=structuredClone(candidate);
  body.classification='executive-reviewed';
  body.expires_at=new Date(Math.min(instant(candidate.expires_at),instant(authorization.expires_at))).toISOString();
  const hash=await sha256(body),snapshot={...body,snapshot_id:'snapshot-'+hash,view_id:'today-'+hash};
  const release=await prepareRelease(snapshot,now);
  const receipt={schema_version:1,kind:'policy-derived-refresh',authorization_digest:anchor.authorization_digest,
    authorized_by:'Steve',authorized_at:authorization.approved_at,bound_at:new Date(now).toISOString(),expires_at:snapshot.expires_at,
    site_project_id:siteProjectId,saved_version_id:savedVersionId,candidate_digest:review.candidate_digest,candidate_expires_at:candidate.expires_at,
    reviewed_by:review.reviewed_by,reviewed_at:review.reviewed_at,policy:review.policy,release_digest:release.digest};
  const grant={authorization:structuredClone(authorization),anchor:structuredClone(anchor)};
  await validateDerivedRefresh(snapshot,receipt,grant,now);
  return {snapshot,release,receipt,grant};
}
