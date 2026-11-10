CREATE TABLE `bucket_progress` (
	`bucket_name` text PRIMARY KEY,
	`round` integer DEFAULT 1 NOT NULL,
	`pointer` integer DEFAULT 0 NOT NULL,
	`round_started_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_bucket_progress_bucket_name_bucket_name_fk` FOREIGN KEY (`bucket_name`) REFERENCES `bucket`(`name`) ON DELETE CASCADE
);
