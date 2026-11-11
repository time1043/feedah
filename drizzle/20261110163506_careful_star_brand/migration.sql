CREATE TABLE `review_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`bucket_name` text NOT NULL,
	`round` integer NOT NULL,
	`counted` integer DEFAULT false NOT NULL,
	`number` integer,
	`queue` text DEFAULT '[]' NOT NULL,
	`last_position` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`updated_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_review_session_bucket_name_bucket_name_fk` FOREIGN KEY (`bucket_name`) REFERENCES `bucket`(`name`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_review_session_round` ON `review_session` (`bucket_name`,`round`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_session_draft_unique` ON `review_session` (`bucket_name`,`round`) WHERE counted = 0;