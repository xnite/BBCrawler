CREATE TABLE IF NOT EXISTS `servers` (
	`sid` INT(11) NOT NULL AUTO_INCREMENT,
	`address` VARCHAR(32) NOT NULL,
	`port` INT(5) NOT NULL DEFAULT '25565',
	`version` VARCHAR(96) DEFAULT NULL,
    `city` VARCHAR(96) DEFAULT NULL,
    `country` VARCHAR(96) DEFAULT NULL,
    `country_code` VARCHAR(96) DEFAULT NULL,
    `region` VARCHAR(96) DEFAULT NULL,
	`players_online` INT(20) NOT NULL DEFAULT '0',
	`players_limit` INT(20) NOT NULL DEFAULT '1',
	`motd` VARCHAR(2000) DEFAULT NULL,
    `public` BOOLEAN NOT NULL DEFAULT TRUE,
	UNIQUE KEY `unique_server` (`address`,`port`) USING BTREE,
	PRIMARY KEY (`sid`)
) ENGINE=InnoDB;