CREATE TABLE `trails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`difficulty` text NOT NULL,
	`distance_meters` real NOT NULL,
	`elevation_gain_meters` real NOT NULL,
	`elevation_loss_meters` real NOT NULL,
	`description` text,
	`geometry` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
