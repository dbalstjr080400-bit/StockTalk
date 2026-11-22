import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing the existing auth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
  profileNickname: varchar("profileNickname", { length: 40 }),
  loginId: varchar("loginId", { length: 80 }),
  passwordHash: text("passwordHash"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "staff"]).default("user").notNull(),
  isSuspended: boolean("isSuspended").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [uniqueIndex("users_profile_nickname_unique").on(table.profileNickname), uniqueIndex("users_login_id_unique").on(table.loginId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const follows = mysqlTable(
  "follows",
  {
    id: int("id").autoincrement().primaryKey(),
    followerUserId: int("followerUserId").notNull().references(() => users.id),
    followedUserId: int("followedUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("follows_follower_followed_unique").on(table.followerUserId, table.followedUserId),
    index("follows_followed_idx").on(table.followedUserId),
  ]
);

export const discussionPosts = mysqlTable(
  "discussion_posts",
  {
    id: int("id").autoincrement().primaryKey(),
    ticker: varchar("ticker", { length: 32 }).notNull(),
    stockName: varchar("stockName", { length: 100 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    content: text("content").notNull(),
    authorUserId: int("authorUserId").references(() => users.id),
    author: varchar("author", { length: 40 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    isEdited: boolean("isEdited").default(false).notNull(),
    // No view-increment endpoint is currently provided, so new posts start at zero.
    views: int("views").default(0).notNull(),
    isDemo: boolean("isDemo").default(false).notNull(),
    // Stable keys make the one-time demo seed repeatable without replacing edits.
    seedKey: varchar("seedKey", { length: 64 }),
  },
  table => [
    uniqueIndex("discussion_posts_seed_key_unique").on(table.seedKey),
    index("discussion_posts_created_at_idx").on(table.createdAt),
    index("discussion_posts_ticker_idx").on(table.ticker),
  ]
);

export const discussionComments = mysqlTable(
  "discussion_comments",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId")
      .notNull()
      .references(() => discussionPosts.id),
    parentCommentId: int("parentCommentId"),
    authorUserId: int("authorUserId").references(() => users.id),
    author: varchar("author", { length: 40 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    isEdited: boolean("isEdited").default(false).notNull(),
  },
  table => [index("discussion_comments_post_id_idx").on(table.postId)]
);

export const discussionLikes = mysqlTable(
  "discussion_likes",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId")
      .notNull()
      .references(() => discussionPosts.id),
    userId: int("userId").references(() => users.id),
    // Only the SHA-256 digest is stored, not the supplied browser identifier.
    visitorHash: varchar("visitorHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("discussion_likes_post_visitor_unique").on(
      table.postId,
      table.visitorHash
    ),
  ]
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    recipientUserId: int("recipientUserId")
      .notNull()
      .references(() => users.id),
    actorUserId: int("actorUserId").references(() => users.id),
    type: mysqlEnum("type", ["mention", "like"]).notNull(),
    postId: int("postId").references(() => discussionPosts.id),
    commentId: int("commentId").references(() => discussionComments.id),
    message: varchar("message", { length: 255 }).notNull(),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("notifications_recipient_created_idx").on(table.recipientUserId, table.createdAt),
    index("notifications_recipient_read_idx").on(table.recipientUserId, table.isRead),
  ]
);

export const discussionReports = mysqlTable(
  "discussion_reports",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId").notNull().references(() => discussionPosts.id),
    commentId: int("commentId"),
    reporter: varchar("reporter", { length: 40 }).notNull(),
    reason: varchar("reason", { length: 200 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("discussion_reports_post_id_idx").on(table.postId)]
);

export const adminMessages = mysqlTable(
  "admin_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    senderUserId: int("senderUserId").references(() => users.id),
    senderName: varchar("senderName", { length: 40 }).notNull(),
    senderEmail: varchar("senderEmail", { length: 320 }),
    category: mysqlEnum("category", ["문의", "건의"]).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    content: text("content").notNull(),
    status: mysqlEnum("status", ["new", "read", "resolved"]).default("new").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("admin_messages_status_created_idx").on(table.status, table.createdAt)]
);
