ALTER TABLE `sessions` ADD `source` text DEFAULT 'board' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `location` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `name` text;