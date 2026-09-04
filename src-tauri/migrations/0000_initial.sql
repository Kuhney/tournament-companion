CREATE TABLE `groups` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL UNIQUE);
--> statement-breakpoint
CREATE TABLE `teams` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL UNIQUE, `short_name` text, `color` text, `logo` text, `group_id` integer REFERENCES `groups`(`id`) ON DELETE set null, `players` text DEFAULT '' NOT NULL);
--> statement-breakpoint
CREATE TABLE `rounds` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `round_number` integer NOT NULL, `phase` text DEFAULT 'group' NOT NULL, `name` text NOT NULL, `scheduled_start` text, `started_at` text, `end_time` text, `remaining_seconds` integer, `duration_seconds` integer DEFAULT 600 NOT NULL, `status` text DEFAULT 'scheduled' NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_phase_number` ON `rounds` (`phase`,`round_number`);
--> statement-breakpoint
CREATE TABLE `matches` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `phase` text DEFAULT 'group' NOT NULL, `group_id` integer REFERENCES `groups`(`id`) ON DELETE set null, `round_id` integer NOT NULL REFERENCES `rounds`(`id`) ON DELETE cascade, `round` integer NOT NULL, `table_number` integer NOT NULL, `scheduled_at` text NOT NULL, `team_a_id` integer REFERENCES `teams`(`id`) ON DELETE restrict, `team_b_id` integer REFERENCES `teams`(`id`) ON DELETE restrict, `score_a` integer, `score_b` integer, `status` text DEFAULT 'scheduled' NOT NULL, `next_match_id` integer, `next_match_slot` text);
--> statement-breakpoint
CREATE TABLE `tournament_settings` (`id` integer PRIMARY KEY NOT NULL, `current_phase` text DEFAULT 'group' NOT NULL, `current_round_id` integer REFERENCES `rounds`(`id`) ON DELETE set null, `display_mode` text DEFAULT 'auto' NOT NULL, `display_rotation_seconds` integer DEFAULT 10 NOT NULL, `config` text DEFAULT '{}' NOT NULL);
