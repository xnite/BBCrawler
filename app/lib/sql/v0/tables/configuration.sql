CREATE TABLE IF NOT EXISTS `configuration` (
	`cvid` INT(11) NOT NULL AUTO_INCREMENT,
	`config_var` VARCHAR(32) NOT NULL,
	`config_val` VARCHAR(256) DEFAULT NULL,
	UNIQUE KEY `conf_name` (`config_var`) USING BTREE,
	PRIMARY KEY (`cvid`)
) ENGINE=InnoDB;