ALTER TABLE `recording_sessions` ADD `segment_started_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `recording_sessions` SET `segment_started_at` = `started_at`;
