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
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const discussionPosts = mysqlTable(
  "discussion_posts",
  {
    id: int("id").autoincrement().primaryKey(),
    ticker: varchar("ticker", { length: 32 }).notNull(),
    stockName: varchar("stockName", { length: 100 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    content: text("content").notNull(),
    author: varchar("author", { length: 40 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
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
    author: varchar("author", { length: 40 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
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
