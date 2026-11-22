CREATE TABLE `admin_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderUserId` int,
	`senderName` varchar(40) NOT NULL,
	`senderEmail` varchar(320),
	`category` enum('문의','건의') NOT NULL,
	`title` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`status` enum('new','read','resolved') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_messages` ADD CONSTRAINT `admin_messages_senderUserId_users_id_fk` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_messages_status_created_idx` ON `admin_messages` (`status`,`createdAt`);