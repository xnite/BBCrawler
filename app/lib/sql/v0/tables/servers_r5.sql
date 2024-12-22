ALTER TABLE `servers`
ADD `offline_mode` BOOLEAN NULL DEFAULT 0 AFTER `port`;