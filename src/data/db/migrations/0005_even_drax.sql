ALTER TABLE `recording_points` ADD `segment` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recording_sessions` ADD `current_segment` integer DEFAULT 0 NOT NULL;