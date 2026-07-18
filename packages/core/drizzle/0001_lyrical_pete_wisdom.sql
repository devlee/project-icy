ALTER TABLE `characters` ADD `origin` text DEFAULT 'original' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `ip_source` text DEFAULT '' NOT NULL;