ALTER TABLE `recording_sessions` ADD `singleton` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `recording_sessions_singleton_unique` ON `recording_sessions` (`singleton`);