CREATE TABLE `answer_log` (
	`id` text PRIMARY KEY,
	`bucket_id` text NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`mode` text NOT NULL,
	`correct` integer NOT NULL,
	`answered_at` integer NOT NULL,
	CONSTRAINT `fk_answer_log_bucket_id_bucket_id_fk` FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `bucket` ADD `content_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `word` ADD `distractors` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_answer_log_round` ON `answer_log` (`bucket_id`,`round`);