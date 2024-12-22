CREATE TABLE IF NOT EXISTS `users` (
	`uid` INT(11) NOT NULL AUTO_INCREMENT,
	`username` VARCHAR(32) NOT NULL,
    `password` VARCHAR(256) NOT NULL,
    `email` VARCHAR(128) NOT NULL,
    `email:confirmed` TINYINT(1) NOT NULL DEFAULT 0,
    `email:confirm_code` VARCHAR(256) DEFAULT NULL,
	UNIQUE KEY `unique_email` (`email`,`email:confirmed`) USING BTREE,
	PRIMARY KEY (`uid`)
) ENGINE=InnoDB;