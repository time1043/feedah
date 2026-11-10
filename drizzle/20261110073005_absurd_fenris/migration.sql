CREATE TABLE `round_flag` (
	`bucket_name` text NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`flagged_at` integer NOT NULL,
	CONSTRAINT `round_flag_pk` PRIMARY KEY(`bucket_name`, `round`, `position`),
	CONSTRAINT `fk_round_flag_bucket_name_bucket_name_fk` FOREIGN KEY (`bucket_name`) REFERENCES `bucket`(`name`) ON DELETE CASCADE
);
