// Platform D1 stores audit receipts, never authoritative tasks or draft bodies.
import { nextDecision } from '../command-center/approvals.mjs';
import { requireThat, sha256 } from '../command-center/context.mjs';
export class ApprovalStore {
  constructor(db) {
    requireThat(
      db && typeof db.prepare === 'function',
      'approval_storage_unavailable',
    );
    this.db = db;
  }
  async latest(digest, owner) {
    return await this.db
      .prepare(
        'SELECT * FROM approval_events WHERE proposal_digest=? AND owner_id=? ORDER BY revision DESC LIMIT 1',
      )
      .bind(digest, owner)
      .first();
  }
  async history(owner, cursor = null) {
    const after = cursor
      ? await this.db
          .prepare(
            'SELECT recorded_at,event_id FROM approval_events WHERE event_id=? AND owner_id=?',
          )
          .bind(cursor, owner)
          .first()
      : null;
    requireThat(!cursor || after, 'invalid_history_cursor');
    const result = await this.db
      .prepare(
        'SELECT e.* FROM approval_events e WHERE owner_id=? AND revision=(SELECT MAX(revision) FROM approval_events WHERE proposal_digest=e.proposal_digest AND owner_id=e.owner_id) AND (recorded_at<? OR (recorded_at=? AND event_id<?)) ORDER BY recorded_at DESC,event_id DESC LIMIT 101',
      )
      .bind(
        owner,
        after?.recorded_at ?? '9999-12-31T23:59:59Z',
        after?.recorded_at ?? '9999-12-31T23:59:59Z',
        after?.event_id ?? 'f'.repeat(64),
      )
      .all();
    const receipts = result.results.slice(0, 100);
    return {
      receipts,
      next_cursor:
        result.results.length > 100 ? receipts.at(-1).event_id : null,
    };
  }
  async revoke({ digest, owner, expectedRevision, now }) {
    const prior = await this.latest(digest, owner);
    requireThat(prior, 'approval_not_found');
    // Revocation survives catalog rotation, expiry and disabled capture. No body is needed.
    return this.decide({
      proposal: {
        digest,
        proposal_id: prior.proposal_id,
        kind: prior.kind,
        source_url: prior.source_ref,
        source_revision: prior.source_revision,
        executor: prior.executor,
        expires_at: prior.expires_at,
      },
      catalogDigest: prior.catalog_digest,
      owner,
      decision: 'revoke',
      expectedRevision,
      now,
    });
  }
  async decide({
    proposal,
    catalogDigest,
    owner,
    decision,
    expectedRevision,
    now,
  }) {
    let prior = await this.latest(proposal.digest, owner);
    if (prior?.decision === decision) {
      nextDecision(prior.decision, decision);
      return prior;
    }
    requireThat(
      (prior?.revision ?? 0) === expectedRevision,
      'decision_conflict',
    );
    nextDecision(prior?.decision ?? null, decision);
    // A single conditional statement is atomic, including racing tabs/agents.
    const eventId = await sha256({
      owner,
      proposal_digest: proposal.digest,
      revision: expectedRevision + 1,
      decision,
    });
    const row = await this.db
      .prepare(
        'INSERT INTO approval_events (event_id,proposal_digest,proposal_id,catalog_digest,owner_id,kind,source_ref,source_revision,executor,decision,revision,recorded_at,expires_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ?=COALESCE((SELECT MAX(revision) FROM approval_events WHERE proposal_digest=? AND owner_id=?),0) RETURNING *',
      )
      .bind(
        eventId,
        proposal.digest,
        proposal.proposal_id,
        catalogDigest,
        owner,
        proposal.kind,
        proposal.source_url,
        proposal.source_revision,
        proposal.executor,
        decision,
        expectedRevision + 1,
        new Date(now).toISOString(),
        proposal.expires_at,
        expectedRevision,
        proposal.digest,
        owner,
      )
      .first();
    if (row) return row;
    prior = await this.latest(proposal.digest, owner);
    requireThat(prior?.decision === decision, 'decision_conflict');
    return prior;
  }
}
