ALTER TABLE `recording_sessions` ADD `paused_at` integer;--> statement-breakpoint
ALTER TABLE `recording_sessions` ADD `paused_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `recording_sessions` SET `ended_at` = NULL WHERE `ended_at` IS NOT NULL;