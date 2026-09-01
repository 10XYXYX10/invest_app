CREATE TABLE `nav_bars` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`close` real NOT NULL,
	`net_assets` real,
	`distribution` real,
	PRIMARY KEY(`symbol`, `date`)
);
--> statement-breakpoint
CREATE INDEX `nav_bars_symbol_date_idx` ON `nav_bars` (`symbol`,`date`);--> statement-breakpoint
CREATE TABLE `series_meta` (
	`symbol` text PRIMARY KEY NOT NULL,
	`fetched_at` text NOT NULL,
	`first_trade_date` text
);
