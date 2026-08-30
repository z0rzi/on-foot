ALTER TABLE `recording_sessions` ADD `paused_at` integer;--> statement-breakpoint
ALTER TABLE `recording_sessions` ADD `paused_ms` integer DEFAULT 0 NOT NULL;