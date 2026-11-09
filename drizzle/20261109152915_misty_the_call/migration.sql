CREATE TABLE `bucket` (
	`name` text PRIMARY KEY,
	`word_count` integer NOT NULL,
	`content_hash` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `word` (
	`bucket_name` text NOT NULL,
	`position` integer NOT NULL,
	`word` text NOT NULL,
	`ipa` text DEFAULT '' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`forms` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `word_pk` PRIMARY KEY(`bucket_name`, `position`),
	CONSTRAINT `fk_word_bucket_name_bucket_name_fk` FOREIGN KEY (`bucket_name`) REFERENCES `bucket`(`name`) ON DELETE CASCADE
);
