CREATE TABLE `discussion_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`author` varchar(40) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discussion_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discussion_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`visitorHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discussion_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `discussion_likes_post_visitor_unique` UNIQUE(`postId`,`visitorHash`)
);
--> statement-breakpoint
CREATE TABLE `discussion_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(32) NOT NULL,
	`stockName` varchar(100) NOT NULL,
	`category` varchar(30) NOT NULL,
	`title` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`author` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`views` int NOT NULL DEFAULT 0,
	`isDemo` boolean NOT NULL DEFAULT false,
	`seedKey` varchar(64),
	CONSTRAINT `discussion_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `discussion_posts_seed_key_unique` UNIQUE(`seedKey`)
);
--> statement-breakpoint
ALTER TABLE `discussion_comments` ADD CONSTRAINT `discussion_comments_postId_discussion_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `discussion_posts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discussion_likes` ADD CONSTRAINT `discussion_likes_postId_discussion_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `discussion_posts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `discussion_comments_post_id_idx` ON `discussion_comments` (`postId`);--> statement-breakpoint
CREATE INDEX `discussion_posts_created_at_idx` ON `discussion_posts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `discussion_posts_ticker_idx` ON `discussion_posts` (`ticker`);

--> statement-breakpoint
INSERT INTO `discussion_posts` (`ticker`, `stockName`, `category`, `title`, `content`, `author`, `createdAt`, `isDemo`, `seedKey`) VALUES
  ('005930', '삼성전자', '자유', '[예시] 반도체 업황을 볼 때 어떤 지표를 참고하시나요?', '이 글은 서비스 이용 방법을 보여 주는 가상의 예시입니다. 실적 발표와 업황 지표를 함께 살펴보는 이야기를 나눠 보세요.', '예시 작성자', DATE_SUB(NOW(), INTERVAL 2 HOUR), true, 'demo-v1-samsung'),
  ('000660', 'SK하이닉스', '분석', '[예시] 실적 발표 전에 체크할 점', '이 글은 가상의 예시입니다. 실적 발표 일정, 투자 계획, 업황 변화를 어떻게 확인하는지 의견을 나눠 보세요.', '예시 작성자', DATE_SUB(NOW(), INTERVAL 5 HOUR), true, 'demo-v1-hynix'),
  ('035420', 'NAVER', '질문', '[예시] 장기 관점에서 어떤 자료를 보시나요?', '이 글은 가상의 예시입니다. 사업보고서와 공시를 읽을 때 주목하는 항목이 있다면 이야기해 보세요.', '예시 작성자', DATE_SUB(NOW(), INTERVAL 10 HOUR), true, 'demo-v1-naver'),
  ('035720', '카카오', '자유', '[예시] 관심 종목을 살펴보는 나만의 기준', '이 글은 가상의 예시입니다. 관심 종목을 정리할 때 참고하는 기준에 대해 자유롭게 대화해 보세요.', '예시 작성자', DATE_SUB(NOW(), INTERVAL 1 DAY), true, 'demo-v1-kakao')
ON DUPLICATE KEY UPDATE `seedKey` = `discussion_posts`.`seedKey`;
