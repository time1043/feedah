ALTER TABLE `bucket_progress` ADD `progress_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_pointer` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_stat` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `meta` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `round_history` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `round_word` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `word` ADD `flagged_at` integer DEFAULT 0 NOT NULL;