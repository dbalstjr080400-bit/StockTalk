ALTER TABLE `discussion_comments` ADD `isEdited` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `discussion_reports` ADD `commentId` int;