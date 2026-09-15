// Trusted host post-publication hook. Call the existing authenticated Site
// readers, never accept producer-supplied success flags as publication evidence.
import {canonical,requireThat,sha256,instant} from './context.mjs';
import {rememberPublication} from './attention-retention.mjs';
import {updateRetainedAttention} from './refresh.mjs';

export async function retainPublishedReview({root,snapshot,publication,expectedProjectId,expectedVersionId,readDeployment,readPublishedContext,now=Date.now()}) {
  requireThat(typeof readDeployment==='function'&&typeof readPublishedContext==='function','verified_publication_required');
  const deployment=await readDeployment(publication.id);
  requireThat(deployment&&deployment.id===publication.id&&deployment.project_id===expectedProjectId
    &&deployment.version_id===expectedVersionId&&deployment.status==='succeeded'
    &&deployment.type==='publish','verified_publication_required');
  // The owner/access binding remains the responsibility of the existing trusted
  // readers. This module neither obtains credentials nor changes Site access.
  const visible=await readPublishedContext();
  requireThat(canonical(visible)===canonical(snapshot)&&await sha256(visible)===publication.snapshot_digest,'publication_readback_mismatch');
  requireThat(instant(publication.published_at)<=now,'future_publication');
  return updateRetainedAttention({root,update:store=>rememberPublication({store,snapshot,publication,now,
    verifyPublication:async({snapshot:checked,publication:receipt})=>canonical(checked)===canonical(visible)
      &&receipt.id===deployment.id&&receipt.snapshot_digest===await sha256(visible)})});
}
