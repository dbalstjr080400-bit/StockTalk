import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  discussionComments,
  discussionLikes,
  discussionPosts,
  discussionReports,
  follows,
  notifications,
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

    const textFields = ["name", "email", "loginMethod", "profileNickname"] as const;
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
    if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
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

export async function updateUserNickname(userId: number, profileNickname: string) {
  const db = await requireDb();
  const [existing] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.profileNickname, profileNickname), sql`${users.id} <> ${userId}`)).limit(1);
  if (existing) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 닉네임입니다." });
  await db.update(users).set({ profileNickname }).where(eq(users.id, userId));
  return { success: true } as const;
}

function hashLocalPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyLocalPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function registerLocalUser(input: { loginId: string; password: string; name: string; profileNickname: string }) {
  const db = await requireDb();
  const [duplicateLoginId] = await db.select({ id: users.id }).from(users).where(eq(users.loginId, input.loginId)).limit(1);
  if (duplicateLoginId) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 아이디입니다." });
  const [duplicateNickname] = await db.select({ id: users.id }).from(users).where(eq(users.profileNickname, input.profileNickname)).limit(1);
  if (duplicateNickname) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 닉네임입니다." });
  const openId = `local:${randomBytes(24).toString("hex")}`;
  await db.insert(users).values({ openId, loginId: input.loginId, passwordHash: hashLocalPassword(input.password), name: input.name, profileNickname: input.profileNickname, loginMethod: "password" });
  const [created] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return created;
}

export async function authenticateLocalUser(loginId: string, password: string) {
  const db = await requireDb();
  const [user] = await db.select().from(users).where(eq(users.loginId, loginId)).limit(1);
  if (!user?.passwordHash || !verifyLocalPassword(password, user.passwordHash)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }
  if (user.isSuspended) throw new TRPCError({ code: "FORBIDDEN", message: "이 계정은 이용이 제한되어 있습니다." });
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
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
  "ticker" | "stockName" | "category" | "title" | "content" | "author" | "authorUserId"
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
      isEdited: discussionPosts.isEdited,
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

export async function updateDiscussionPost(input: { postId: number; author: string; title: string; content: string }) {
  const db = await requireDb();
  const [post] = await db.select({ id: discussionPosts.id, author: discussionPosts.author }).from(discussionPosts).where(eq(discussionPosts.id, input.postId)).limit(1);
  if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "게시글을 찾을 수 없습니다." });
  if (post.author !== input.author) throw new TRPCError({ code: "FORBIDDEN", message: "작성자 본인만 수정할 수 있습니다." });
  await db.update(discussionPosts).set({ title: input.title, content: input.content, isEdited: true }).where(eq(discussionPosts.id, input.postId));
  return { success: true } as const;
}

export async function deleteDiscussionPost(postId: number, author: string) {
  const db = await requireDb();
  const [post] = await db.select({ id: discussionPosts.id, author: discussionPosts.author }).from(discussionPosts).where(eq(discussionPosts.id, postId)).limit(1);
  if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "게시글을 찾을 수 없습니다." });
  if (post.author !== author) throw new TRPCError({ code: "FORBIDDEN", message: "작성자 본인만 삭제할 수 있습니다." });
  await db.transaction(async tx => {
    await tx.delete(discussionComments).where(eq(discussionComments.postId, postId));
    await tx.delete(discussionLikes).where(eq(discussionLikes.postId, postId));
    await tx.delete(discussionPosts).where(eq(discussionPosts.id, postId));
  });
  return { success: true } as const;
}

export async function reportDiscussionPost(input: { postId: number; commentId?: number; reporter: string; reason: string }) {
  const db = await requireDb();
  const [post] = await db.select({ id: discussionPosts.id }).from(discussionPosts).where(eq(discussionPosts.id, input.postId)).limit(1);
  if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "게시글을 찾을 수 없습니다." });
  await db.insert(discussionReports).values(input);
  return { success: true } as const;
}

export async function getAdminSnapshot() {
  const db = await requireDb();
  const [reports, members, posts] = await Promise.all([
    db.select({ id: discussionReports.id, postId: discussionReports.postId, commentId: discussionReports.commentId, reporter: discussionReports.reporter, reason: discussionReports.reason, createdAt: discussionReports.createdAt, postTitle: discussionPosts.title }).from(discussionReports).leftJoin(discussionPosts, eq(discussionReports.postId, discussionPosts.id)).orderBy(desc(discussionReports.createdAt)).limit(100),
    db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, isSuspended: users.isSuspended, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt)).limit(200),
    db.select({ id: discussionPosts.id, title: discussionPosts.title, author: discussionPosts.author, category: discussionPosts.category, createdAt: discussionPosts.createdAt }).from(discussionPosts).orderBy(desc(discussionPosts.createdAt)).limit(100),
  ]);
  return { reports, members, posts };
}

export async function adminDeleteDiscussionPost(postId: number) {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx.delete(discussionComments).where(eq(discussionComments.postId, postId));
    await tx.delete(discussionLikes).where(eq(discussionLikes.postId, postId));
    await tx.delete(discussionReports).where(eq(discussionReports.postId, postId));
    await tx.delete(discussionPosts).where(eq(discussionPosts.id, postId));
  });
  return { success: true } as const;
}

export async function setUserSuspended(userId: number, suspended: boolean) {
  const db = await requireDb();
  await db.update(users).set({ isSuspended: suspended }).where(eq(users.id, userId));
  return { success: true } as const;
}
export async function setUserRole(userId: number, role: "user" | "staff") {
  const db = await requireDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return { success: true } as const;
}
export async function incrementDiscussionViews(postId: number) {
  const db = await requireDb();
  const result = await db
    .update(discussionPosts)
    .set({ views: sql`${discussionPosts.views} + 1` })
    .where(eq(discussionPosts.id, postId));
  if (Number(result[0]?.affectedRows ?? 0) === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "게시글을 찾을 수 없습니다." });
  }
  return { success: true } as const;
}

export async function toggleDiscussionLike(postId: number, visitorId: string, actorUserId?: number) {
  const db = await requireDb();
  const visitorHash = hashVisitorId(visitorId);

  return db.transaction(async tx => {
    // Lock the parent row to serialize toggles for this post, including two
    // concurrent requests from the same visitor. The unique index is a backstop.
    const [post] = await tx
      .select({ id: discussionPosts.id, authorUserId: discussionPosts.authorUserId, title: discussionPosts.title })
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
      await tx.insert(discussionLikes).values({ postId, visitorHash, userId: actorUserId });
      if (actorUserId && post.authorUserId && actorUserId !== post.authorUserId) {
        await tx.insert(notifications).values({ recipientUserId: post.authorUserId, actorUserId, type: "like", postId, message: `회원님의 게시글에 하트를 눌렀습니다: ${post.title}` });
      }
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
      parentCommentId: discussionComments.parentCommentId,
      author: discussionComments.author,
      content: discussionComments.content,
      createdAt: discussionComments.createdAt,
      isEdited: discussionComments.isEdited,
    })
    .from(discussionComments)
    .where(eq(discussionComments.postId, postId))
    .orderBy(asc(discussionComments.createdAt), asc(discussionComments.id));
}

export async function addDiscussionComment(input: {
  postId: number;
  parentCommentId?: number;
  author: string;
  content: string;
  authorUserId?: number;
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
  if (input.parentCommentId) {
    const [parent] = await db
      .select({ id: discussionComments.id, postId: discussionComments.postId })
      .from(discussionComments)
      .where(eq(discussionComments.id, input.parentCommentId))
      .limit(1);
    if (!parent || parent.postId !== input.postId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "답글을 달 댓글을 찾을 수 없습니다." });
    }
  }
  const [created] = await db.insert(discussionComments).values(input).$returningId();
  if (input.authorUserId) {
    const taggedNicknames = [...input.content.matchAll(/@[\p{L}\p{N}_-]{1,40}/gu)].map(match => match[0].slice(1));
    const uniqueNicknames = [...new Set(taggedNicknames)];
    if (uniqueNicknames.length) {
      const taggedUsers = await db.select({ id: users.id, profileNickname: users.profileNickname }).from(users).where(inArray(users.profileNickname, uniqueNicknames));
      const recipients = taggedUsers.filter(user => user.id !== input.authorUserId && user.profileNickname);
      if (recipients.length) await db.insert(notifications).values(recipients.map(user => ({ recipientUserId: user.id, actorUserId: input.authorUserId, type: "mention" as const, postId: input.postId, commentId: created.id, message: `${input.author}님이 댓글에서 회원님을 언급했습니다.` })));
    }
  }
  return { success: true } as const;
}

export async function updateDiscussionComment(input: { commentId: number; author: string; content: string }) {
  const db = await requireDb();
  const [comment] = await db.select({ id: discussionComments.id, author: discussionComments.author }).from(discussionComments).where(eq(discussionComments.id, input.commentId)).limit(1);
  if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "댓글을 찾을 수 없습니다." });
  if (comment.author !== input.author) throw new TRPCError({ code: "FORBIDDEN", message: "작성자 본인만 수정할 수 있습니다." });
  await db.update(discussionComments).set({ content: input.content, isEdited: true }).where(eq(discussionComments.id, input.commentId));
  return { success: true } as const;
}

export async function deleteDiscussionComment(commentId: number, author: string) {
  const db = await requireDb();
  const [comment] = await db.select({ id: discussionComments.id, author: discussionComments.author }).from(discussionComments).where(eq(discussionComments.id, commentId)).limit(1);
  if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "댓글을 찾을 수 없습니다." });
  if (comment.author !== author) throw new TRPCError({ code: "FORBIDDEN", message: "작성자 본인만 삭제할 수 있습니다." });
  await db.delete(discussionComments).where(eq(discussionComments.id, commentId));
  return { success: true } as const;
}


export async function listNotifications(userId: number) {
  const db = await requireDb();
  const [items, unread] = await Promise.all([
    db.select({ id: notifications.id, type: notifications.type, postId: notifications.postId, commentId: notifications.commentId, message: notifications.message, isRead: notifications.isRead, createdAt: notifications.createdAt, actorName: users.profileNickname }).from(notifications).leftJoin(users, eq(notifications.actorUserId, users.id)).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(100),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(notifications).where(and(eq(notifications.recipientUserId, userId), eq(notifications.isRead, false))),
  ]);
  return { items, unreadCount: unread[0]?.count ?? 0 };
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await requireDb();
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, userId)));
  return { success: true } as const;
}

export async function markAllNotificationsRead(userId: number) {
  const db = await requireDb();
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.recipientUserId, userId), eq(notifications.isRead, false)));
  return { success: true } as const;
}


export async function getPublicProfileByNickname(profileNickname: string) {
  const db = await requireDb();
  const normalizedNickname = profileNickname.trim().replace(/^@/, "");
  const [user] = await db.select({ id: users.id, profileNickname: users.profileNickname, name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(or(
      eq(users.profileNickname, profileNickname),
      eq(users.profileNickname, normalizedNickname),
      eq(users.name, profileNickname),
      eq(users.name, normalizedNickname),
    ))
    .limit(1);
  if (!user) return null;
  const [posts, followers, following, activities] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(discussionPosts).where(eq(discussionPosts.authorUserId, user.id)),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(follows).where(eq(follows.followedUserId, user.id)),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(follows).where(eq(follows.followerUserId, user.id)),
    db.select({ id: discussionPosts.id, ticker: discussionPosts.ticker, stockName: discussionPosts.stockName, category: discussionPosts.category, title: discussionPosts.title, content: discussionPosts.content, author: discussionPosts.author, createdAt: discussionPosts.createdAt, isEdited: discussionPosts.isEdited, views: discussionPosts.views, isDemo: discussionPosts.isDemo })
      .from(discussionPosts).where(eq(discussionPosts.authorUserId, user.id)).orderBy(desc(discussionPosts.createdAt), desc(discussionPosts.id)).limit(50),
  ]);
  return { ...user, postCount: posts[0]?.count ?? 0, followerCount: followers[0]?.count ?? 0, followingCount: following[0]?.count ?? 0, activities };
}

export async function getFollowStatus(followerUserId: number, followedUserId: number) {
  const db = await requireDb();
  const [relation] = await db.select({ id: follows.id }).from(follows)
    .where(and(eq(follows.followerUserId, followerUserId), eq(follows.followedUserId, followedUserId))).limit(1);
  return { following: Boolean(relation) };
}

export async function followUser(followerUserId: number, followedUserId: number) {
  if (followerUserId === followedUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "자기 자신은 팔로우할 수 없습니다." });
  const db = await requireDb();
  await db.insert(follows).values({ followerUserId, followedUserId }).onDuplicateKeyUpdate({ set: { followerUserId } });
  return { following: true } as const;
}

export async function unfollowUser(followerUserId: number, followedUserId: number) {
  const db = await requireDb();
  await db.delete(follows).where(and(eq(follows.followerUserId, followerUserId), eq(follows.followedUserId, followedUserId)));
  return { following: false } as const;
}


export async function searchUserNicknames(query: string) {
  const db = await requireDb();
  const normalized = query.trim().slice(0, 40);
  return db.select({ id: users.id, nickname: users.profileNickname })
    .from(users)
    .where(normalized ? like(users.profileNickname, `%${normalized}%`) : sql`${users.profileNickname} is not null`)
    .orderBy(users.profileNickname)
    .limit(20);
}
