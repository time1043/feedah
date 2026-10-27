CREATE TABLE `bucket` (
	`id` text PRIMARY KEY,
	`word_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bucket_progress` (
	`bucket_id` text PRIMARY KEY,
	`round` integer DEFAULT 1 NOT NULL,
	`pointer` integer DEFAULT 0 NOT NULL,
	`round_started_at` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_bucket_progress_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `daily_pointer` (
	`day` text NOT NULL,
	`bucket_id` text NOT NULL,
	`global_position` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `daily_pointer_pk` PRIMARY KEY(`day`, `bucket_id`),
	CONSTRAINT `fk_daily_pointer_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `daily_stat` (
	`day` text PRIMARY KEY,
	`feed_seconds` integer DEFAULT 0 NOT NULL,
	`app_seconds` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_session` (
	`id` text PRIMARY KEY,
	`bucket_id` text NOT NULL,
	`round` integer NOT NULL,
	`counted` integer DEFAULT false NOT NULL,
	`number` integer,
	`queue` text DEFAULT '[]' NOT NULL,
	`last_position` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`updated_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_review_session_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `round_flag` (
	`bucket_id` text NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`flagged_at` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `round_flag_pk` PRIMARY KEY(`bucket_id`, `round`, `position`),
	CONSTRAINT `fk_round_flag_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `round_history` (
	`bucket_id` text NOT NULL,
	`round` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `round_history_pk` PRIMARY KEY(`bucket_id`, `round`),
	CONSTRAINT `fk_round_history_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `word` (
	`bucket_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`ipa` text DEFAULT '' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`forms` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `word_pk` PRIMARY KEY(`bucket_id`, `position`),
	CONSTRAINT `fk_word_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_review_session_round` ON `review_session` (`bucket_id`,`round`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_session_draft_unique` ON `review_session` (`bucket_id`,`round`) WHERE counted = 0;