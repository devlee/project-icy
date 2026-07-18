CREATE TABLE `post_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_set_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`error` text,
	`output_keys` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pair_set_id`) REFERENCES `pair_sets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_tasks_status_idx` ON `post_tasks` (`status`,`priority`);--> statement-breakpoint
CREATE INDEX `post_tasks_pair_idx` ON `post_tasks` (`pair_set_id`,`created_at`);