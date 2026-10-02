CREATE TABLE `debug_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`t` integer NOT NULL,
	`level` text NOT NULL,
	`area` text NOT NULL,
	`message` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `debug_log_t_idx` ON `debug_log` (`t`);