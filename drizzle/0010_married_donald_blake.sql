ALTER TABLE `users` ADD `loginId` varchar(80);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_login_id_unique` UNIQUE(`loginId`);