CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`effort` text NOT NULL,
	`comments` text,
	`linked_trail_id` integer,
	`geometry` text NOT NULL,
	`distance_meters` real NOT NULL,
	`duration_seconds` integer NOT NULL,
	`elevation_gain_meters` real,
	`elevation_loss_meters` real,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recording_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`ele` real,
	`t` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recording_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`linked_trail_id` integer
);
