PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`difficulty` text NOT NULL,
	`distance_meters` real NOT NULL,
	`elevation_gain_meters` real,
	`elevation_loss_meters` real,
	`description` text,
	`geometry` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_trails`("id", "name", "difficulty", "distance_meters", "elevation_gain_meters", "elevation_loss_meters", "description", "geometry", "created_at", "updated_at") SELECT "id", "name", "difficulty", "distance_meters", "elevation_gain_meters", "elevation_loss_meters", "description", "geometry", "created_at", "updated_at" FROM `trails`;--> statement-breakpoint
DROP TABLE `trails`;--> statement-breakpoint
ALTER TABLE `__new_trails` RENAME TO `trails`;--> statement-breakpoint
PRAGMA foreign_keys=ON;