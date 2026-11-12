CREATE TABLE `daily_pointer` (
	`day` text NOT NULL,
	`bucket_name` text NOT NULL,
	`global_position` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `daily_pointer_pk` PRIMARY KEY(`day`, `bucket_name`),
	CONSTRAINT `fk_daily_pointer_bucket_name_bucket_name_fk` FOREIGN KEY (`bucket_name`) REFERENCES `bucket`(`name`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `daily_stat` (
	`day` text PRIMARY KEY,
	`feed_seconds` integer DEFAULT 0 NOT NULL,
	`app_seconds` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
