CREATE TABLE IF NOT EXISTS `user_keys` (
	`kid` INT(11) NOT NULL AUTO_INCREMENT,
    `uid` INT(11) NOT NULL,
	`access_key` VARCHAR(64) NOT NULL,
	UNIQUE KEY `unique_access_key` (`access_key`) USING BTREE,
	PRIMARY KEY (`kid`)
) ENGINE=InnoDB;