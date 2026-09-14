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
