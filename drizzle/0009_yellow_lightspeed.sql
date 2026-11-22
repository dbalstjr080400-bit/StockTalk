CREATE TABLE `follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`followerUserId` int NOT NULL,
	`followedUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `follows_follower_followed_unique` UNIQUE(`followerUserId`,`followedUserId`)
);
--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_followerUserId_users_id_fk` FOREIGN KEY (`followerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_followedUserId_users_id_fk` FOREIGN KEY (`followedUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `follows_followed_idx` ON `follows` (`followedUserId`);