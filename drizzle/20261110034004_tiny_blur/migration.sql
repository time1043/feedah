CREATE TABLE `round_record` (
	`bucket_name` text NOT NULL,
	`round` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	CONSTRAINT `round_record_pk` PRIMARY KEY(`bucket_name`, `round`),
	CONSTRAINT `fk_round_record_bucket_name_bucket_name_fk` FOREIGN KEY (`bucket_name`) REFERENCES `bucket`(`name`) ON DELETE CASCADE
);
