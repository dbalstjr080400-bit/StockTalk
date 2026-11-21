CREATE TABLE `discussion_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`reporter` varchar(40) NOT NULL,
	`reason` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discussion_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `discussion_reports` ADD CONSTRAINT `discussion_reports_postId_discussion_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `discussion_posts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `discussion_reports_post_id_idx` ON `discussion_reports` (`postId`);