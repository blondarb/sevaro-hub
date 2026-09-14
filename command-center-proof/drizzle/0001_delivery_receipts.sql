CREATE TABLE `delivery_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`proposal_digest` text NOT NULL,
	`proposal_id` text NOT NULL,
	`catalog_digest` text NOT NULL,
	`approval_revision` integer NOT NULL,
	`revision` integer NOT NULL,
	`attempt_id` text NOT NULL,
	`supervisor_run_id` text NOT NULL,
	`executor` text NOT NULL,
	`state` text NOT NULL,
	`recorded_at` text NOT NULL,
	`lease_expires_at` text NOT NULL,
	`provider_ref` text,
	`readback_digest` text,
	`reason_code` text,
	`source_revision` text NOT NULL,
	`recorded_via` text NOT NULL,
	`destination_digest` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_events_owner_proposal_revision` ON `delivery_events` (`owner_id`,`proposal_digest`,`revision`);