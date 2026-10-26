ALTER TABLE `bucket` ADD `source` text DEFAULT 'builtin' NOT NULL;--> statement-breakpoint
ALTER TABLE `bucket` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bucket` ADD `kind` text DEFAULT 'word' NOT NULL;--> statement-breakpoint
ALTER TABLE `bucket` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `bucket` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `round_word` ADD `wrong` integer DEFAULT false NOT NULL;