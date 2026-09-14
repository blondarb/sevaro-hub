import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
// Approval audit only. No project state, message bodies or credentials are persisted.
export const approvalEvents = sqliteTable(
  'approval_events',
  {
    eventId: text('event_id').primaryKey(),
    proposalDigest: text('proposal_digest').notNull(),
    proposalId: text('proposal_id').notNull(),
    catalogDigest: text('catalog_digest').notNull(),
    ownerId: text('owner_id').notNull(),
    kind: text('kind').notNull(),
    sourceRef: text('source_ref').notNull(),
    sourceRevision: text('source_revision').notNull(),
    executor: text('executor').notNull(),
    decision: text('decision').notNull(),
    revision: integer('revision').notNull(),
    recordedAt: text('recorded_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [
    uniqueIndex('approval_events_owner_proposal_revision').on(
      table.ownerId,
      table.proposalDigest,
      table.revision,
    ),
  ],
);

// Dispatch audit: exact hashes and provider references, never message bodies.
export const deliveryEvents=sqliteTable('delivery_events', {
  eventId:text('event_id').primaryKey(),
  ownerId:text('owner_id').notNull(),
  proposalDigest:text('proposal_digest').notNull(),
  proposalId:text('proposal_id').notNull(),
  catalogDigest:text('catalog_digest').notNull(),
  approvalRevision:integer('approval_revision').notNull(),
  revision:integer('revision').notNull(),
  attemptId:text('attempt_id').notNull(),
  supervisorRunId:text('supervisor_run_id').notNull(),
  executor:text('executor').notNull(),
  state:text('state').notNull(),
  recordedAt:text('recorded_at').notNull(),
  leaseExpiresAt:text('lease_expires_at').notNull(),
  providerRef:text('provider_ref'),
  readbackDigest:text('readback_digest'),
  reasonCode:text('reason_code'),
  sourceRevision:text('source_revision').notNull(),
  recordedVia:text('recorded_via').notNull(),
  destinationDigest:text('destination_digest').notNull(),
},table=>[uniqueIndex('delivery_events_owner_proposal_revision').on(table.ownerId,table.proposalDigest,table.revision)]);
