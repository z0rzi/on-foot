UPDATE `activities` SET `linked_trail_id` = NULL WHERE `linked_trail_id` IS NOT NULL AND `linked_trail_id` NOT IN (SELECT `id` FROM `trails`);
--> statement-breakpoint
UPDATE `recording_sessions` SET `linked_trail_id` = NULL WHERE `linked_trail_id` IS NOT NULL AND `linked_trail_id` NOT IN (SELECT `id` FROM `trails`);
