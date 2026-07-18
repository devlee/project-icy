CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_set_id` text NOT NULL,
	`kind` text NOT NULL,
	`form` text,
	`platform` text DEFAULT 'generic' NOT NULL,
	`file_path` text NOT NULL,
	`watermarked` integer DEFAULT false NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pair_set_id`) REFERENCES `pair_sets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assets_pair_set_idx` ON `assets` (`pair_set_id`);--> statement-breakpoint
CREATE TABLE `character_factors` (
	`character_id` text NOT NULL,
	`factor_id` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`factor_id`) REFERENCES `factors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_factors_pk` ON `character_factors` (`character_id`,`factor_id`);--> statement-breakpoint
CREATE TABLE `character_images` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`kind` text NOT NULL,
	`form` text,
	`file_path` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`source_pair_set_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_images_character_idx` ON `character_images` (`character_id`,`kind`);--> statement-breakpoint
CREATE TABLE `character_loras` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`name` text NOT NULL,
	`model_path` text NOT NULL,
	`trigger_words` text DEFAULT '' NOT NULL,
	`recommended_weight` real DEFAULT 0.8 NOT NULL,
	`form` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_loras_character_idx` ON `character_loras` (`character_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`profile` text DEFAULT '' NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_slug_unique` ON `characters` (`slug`);--> statement-breakpoint
CREATE TABLE `factors` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`prompt_fragment` text NOT NULL,
	`negative_fragment` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `factors_category_idx` ON `factors` (`category`);--> statement-breakpoint
CREATE TABLE `generation_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`character_id` text NOT NULL,
	`series_id` text,
	`params` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `generation_tasks_status_idx` ON `generation_tasks` (`status`,`priority`);--> statement-breakpoint
CREATE INDEX `generation_tasks_character_idx` ON `generation_tasks` (`character_id`);--> statement-breakpoint
CREATE TABLE `pair_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`character_id` text NOT NULL,
	`series_id` text,
	`seed` integer NOT NULL,
	`pose_id` text,
	`anime_image_path` text NOT NULL,
	`real_image_path` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`rating` integer,
	`post_process_status` text DEFAULT 'raw' NOT NULL,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `generation_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pose_id`) REFERENCES `poses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pair_sets_review_idx` ON `pair_sets` (`review_status`);--> statement-breakpoint
CREATE INDEX `pair_sets_character_idx` ON `pair_sets` (`character_id`);--> statement-breakpoint
CREATE INDEX `pair_sets_task_idx` ON `pair_sets` (`task_id`);--> statement-breakpoint
CREATE TABLE `poses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`file_path` text NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publish_plan_assets` (
	`plan_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `publish_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `publish_plan_assets_pk` ON `publish_plan_assets` (`plan_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `publish_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`platform` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`hashtags` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `publish_plans_date_idx` ON `publish_plans` (`date`,`platform`);--> statement-breakpoint
CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`name` text NOT NULL,
	`theme` text DEFAULT '' NOT NULL,
	`batch_config` text,
	`schedule_cron` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `series_character_idx` ON `series` (`character_id`);