CREATE TABLE IF NOT EXISTS `user_groups` (
	`membership_id` INT(11) NOT NULL AUTO_INCREMENT,
    `uid` INT(11) NOT NULL,
    `gid` INT(11) NOT NULL,
	UNIQUE KEY `unique_membership` (`uid`,`gid`) USING BTREE,
	PRIMARY KEY (`membership_id`)
) ENGINE=InnoDB;