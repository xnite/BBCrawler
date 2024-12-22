ALTER TABLE `servers`
ADD `last_ping` DATETIME ( 6 ) NOT NULL DEFAULT NOW(),
ADD `plugins` VARCHAR ( 4096 ) NULL DEFAULT NULL,
ADD `player_names` VARCHAR ( 4096 ) NULL DEFAULT NULL,
ADD `most_players` INT ( 11 ) NOT NULL DEFAULT 0,
DROP COLUMN `last_updated`;