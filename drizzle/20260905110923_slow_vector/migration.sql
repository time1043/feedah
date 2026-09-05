CREATE TABLE `bucket` (
	`id` text PRIMARY KEY,
	`word_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bucket_progress` (
	`bucket_id` text PRIMARY KEY,
	`round` integer DEFAULT 1 NOT NULL,
	`pointer` integer DEFAULT 0 NOT NULL,
	`started_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_bucket_progress_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_pointer` (
	`day` text NOT NULL,
	`bucket_id` text NOT NULL,
	`global_position` integer NOT NULL,
	CONSTRAINT `daily_pointer_pk` PRIMARY KEY(`day`, `bucket_id`)
);
--> statement-breakpoint
CREATE TABLE `daily_stat` (
	`day` text PRIMARY KEY,
	`feed_seconds` integer DEFAULT 0 NOT NULL,
	`app_seconds` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `round_history` (
	`bucket_id` text NOT NULL,
	`round` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	CONSTRAINT `round_history_pk` PRIMARY KEY(`bucket_id`, `round`)
);
--> statement-breakpoint
CREATE TABLE `round_word` (
	`bucket_id` text NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`reached` integer DEFAULT false NOT NULL,
	`flagged` integer DEFAULT false NOT NULL,
	`reached_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `round_word_pk` PRIMARY KEY(`bucket_id`, `round`, `position`)
);
--> statement-breakpoint
CREATE TABLE `word` (
	`bucket_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`ipa` text DEFAULT '' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`forms` text DEFAULT '[]' NOT NULL,
	`flagged` integer DEFAULT false NOT NULL,
	CONSTRAINT `word_pk` PRIMARY KEY(`bucket_id`, `position`),
	CONSTRAINT `fk_word_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_word_flag` ON `word` (`bucket_id`,`flagged`);