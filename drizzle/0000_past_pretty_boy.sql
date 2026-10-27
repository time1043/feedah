CREATE TABLE `bucket` (
	`id` text PRIMARY KEY NOT NULL,
	`word_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `word` (
	`bucket_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`ipa` text DEFAULT '' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`forms` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`bucket_id`, `position`),
	FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON UPDATE no action ON DELETE no action
);
