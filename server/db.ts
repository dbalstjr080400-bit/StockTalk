import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  discussionComments,
  discussionLikes,
  discussionPosts,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

type NewDiscussionPost = Pick<
  typeof discussionPosts.$inferInsert,
  "ticker" | "stockName" | "category" | "title" | "content" | "author"
>;

function hashVisitorId(visitorId: string): string {
  return createHash("sha256").update(visitorId, "utf8").digest("hex");
}

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "데이터베이스를 사용할 수 없습니다.",
    });
  }
  return db;
}

export async function listDiscussionPosts(visitorId?: string) {
  const db = await requireDb();
  const visitorHash = visitorId ? hashVisitorId(visitorId) : undefined;
  const likedExpression = visitorHash
    ? sql<number>`exists (select 1 from ${discussionLikes} where \`discussion_likes\`.\`postId\` = \`discussion_posts\`.\`id\` and \`discussion_likes\`.\`visitorHash\` = ${visitorHash})`
    : sql<number>`0`;

  return db
    .select({
      id: discussionPosts.id,
      ticker: discussionPosts.ticker,
      stockName: discussionPosts.stockName,
      category: discussionPosts.category,
      title: discussionPosts.title,
      content: discussionPosts.content,
      author: discussionPosts.author,
      createdAt: discussionPosts.createdAt,
      // Fully qualify correlated columns: Drizzle strips qualifiers in a
      // single-table SELECT, which would otherwise bind `id` to the inner table.
      likes:
        sql<number>`(select count(*) from ${discussionLikes} where \`discussion_likes\`.\`postId\` = \`discussion_posts\`.\`id\`)`.mapWith(
          Number
        ),
      comments:
        sql<number>`(select count(*) from ${discussionComments} where \`discussion_comments\`.\`postId\` = \`discussion_posts\`.\`id\`)`.mapWith(
          Number
        ),
      views: discussionPosts.views,
      liked: likedExpression.mapWith(value => Number(value) === 1),
      isDemo: discussionPosts.isDemo,
    })
    .from(discussionPosts)
    .orderBy(desc(discussionPosts.createdAt), desc(discussionPosts.id));
}

export async function createDiscussionPost(input: NewDiscussionPost) {
  const db = await requireDb();
  const [created] = await db
    .insert(discussionPosts)
    .values(input)
    .$returningId();
  return created.id;
}

export async function toggleDiscussionLike(postId: number, visitorId: string) {
  const db = await requireDb();
  const visitorHash = hashVisitorId(visitorId);

  return db.transaction(async tx => {
    // Lock the parent row to serialize toggles for this post, including two
    // concurrent requests from the same visitor. The unique index is a backstop.
    const [post] = await tx
      .select({ id: discussionPosts.id })
      .from(discussionPosts)
      .where(eq(discussionPosts.id, postId))
      .for("update");
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "게시글을 찾을 수 없습니다.",
      });
    }

    const likeWhere = and(
      eq(discussionLikes.postId, postId),
      eq(discussionLikes.visitorHash, visitorHash)
    );
    const [existing] = await tx
      .select({ id: discussionLikes.id })
      .from(discussionLikes)
      .where(likeWhere)
      .limit(1);
    const liked = !existing;
    if (existing) {
      await tx
        .delete(discussionLikes)
        .where(eq(discussionLikes.id, existing.id));
    } else {
      await tx.insert(discussionLikes).values({ postId, visitorHash });
    }
    const [count] = await tx
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(discussionLikes)
      .where(eq(discussionLikes.postId, postId));
    return { liked, likes: count.value };
  });
}

export async function getDiscussionComments(postId: number) {
  const db = await requireDb();
  const [post] = await db
    .select({ id: discussionPosts.id })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, postId))
    .limit(1);
  if (!post) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "게시글을 찾을 수 없습니다.",
    });
  }
  return db
    .select({
      id: discussionComments.id,
      postId: discussionComments.postId,
      author: discussionComments.author,
      content: discussionComments.content,
      createdAt: discussionComments.createdAt,
    })
    .from(discussionComments)
    .where(eq(discussionComments.postId, postId))
    .orderBy(asc(discussionComments.createdAt), asc(discussionComments.id));
}

export async function addDiscussionComment(input: {
  postId: number;
  author: string;
  content: string;
}) {
  const db = await requireDb();
  const [post] = await db
    .select({ id: discussionPosts.id })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, input.postId))
    .limit(1);
  if (!post) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "게시글을 찾을 수 없습니다.",
    });
  }
  await db.insert(discussionComments).values(input);
  return { success: true } as const;
}
