CREATE TABLE `approval_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`proposal_digest` text NOT NULL,
	`proposal_id` text NOT NULL,
	`catalog_digest` text NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_ref` text NOT NULL,
	`source_revision` text NOT NULL,
	`executor` text NOT NULL,
	`decision` text NOT NULL,
	`revision` integer NOT NULL,
	`recorded_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approval_events_owner_proposal_revision` ON `approval_events` (`owner_id`,`proposal_digest`,`revision`);