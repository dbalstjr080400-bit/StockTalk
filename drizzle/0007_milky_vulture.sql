CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`actorUserId` int,
	`type` enum('mention','like') NOT NULL,
	`postId` int,
	`commentId` int,
	`message` varchar(255) NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `discussion_comments` ADD `authorUserId` int;--> statement-breakpoint
ALTER TABLE `discussion_likes` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `discussion_posts` ADD `authorUserId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `profileNickname` varchar(40);--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_postId_discussion_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `discussion_posts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_commentId_discussion_comments_id_fk` FOREIGN KEY (`commentId`) REFERENCES `discussion_comments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_idx` ON `notifications` (`recipientUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_read_idx` ON `notifications` (`recipientUserId`,`isRead`);--> statement-breakpoint
ALTER TABLE `discussion_comments` ADD CONSTRAINT `discussion_comments_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discussion_likes` ADD CONSTRAINT `discussion_likes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discussion_posts` ADD CONSTRAINT `discussion_posts_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;