import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createPool } from "mysql2/promise";
import { discussionPosts } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

// For the opt-in integration test, make the application's database helper use
// the test's outer transaction. Nested like transactions become savepoints.
const transactionHolder = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("drizzle-orm/mysql2", async importOriginal => {
  const original = await importOriginal<typeof import("drizzle-orm/mysql2")>();
  return {
    ...original,
    drizzle: (...args: Parameters<typeof original.drizzle>) =>
      transactionHolder.db ?? original.drizzle(...args),
  };
});

import { appRouter } from "./routers";

const caller = appRouter.createCaller({
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

const validPost = {
  ticker: "005930",
  stockName: "삼성전자",
  category: "자유",
  title: "테스트 제목",
  content: "테스트 내용",
  author: "테스터",
};

describe("discussion public API", () => {
  it("rejects empty and malformed input before reaching the database", async () => {
    await expect(
      caller.discussion.create({ ...validPost, title: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.discussion.create({ ...validPost, ticker: "bad ticker" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.discussion.create({ ...validPost, stockName: "SK하이닉스" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.discussion.create({ ...validPost, ticker: "UNKNOWN" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.discussion.addComment({
        postId: 0,
        author: "테스터",
        content: "내용",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.discussion.toggleLike({ postId: 1, visitorId: "  " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.discussion.create({ ...validPost, content: "x".repeat(5001) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // The managed DB is shared with production. This test is explicitly opted in,
  // and all its writes, including the test's own like toggle, are rolled back.
  it.skipIf(
    !process.env.DISCUSSION_DB_ROLLBACK_TEST || !process.env.DATABASE_URL
  )(
    "persists posts, comments, and deduplicated likes within a rolled-back transaction",
    async () => {
      const original =
        await vi.importActual<typeof import("drizzle-orm/mysql2")>(
          "drizzle-orm/mysql2"
        );
      const pool = createPool(process.env.DATABASE_URL!);
      const db = original.drizzle(pool);
      const rollback = new Error("rollback test-only writes");
      let createdId = 0;
      try {
        try {
          await db.transaction(async tx => {
            transactionHolder.db = tx;
            createdId = await caller.discussion.create({
              ...validPost,
              title: "  테스트 제목  ",
            });
            expect(createdId).toBeGreaterThan(0);
            let posts = await caller.discussion.list({
              visitorId: "test-visitor-a",
            });
            expect(posts.find(p => p.id === createdId)).toMatchObject({
              title: "테스트 제목",
              likes: 0,
              comments: 0,
              views: 0,
              liked: false,
              isDemo: false,
            });
            expect(
              posts.find(p => p.id === createdId)?.createdAt
            ).toBeInstanceOf(Date);

            expect(
              await caller.discussion.toggleLike({
                postId: createdId,
                visitorId: "test-visitor-a",
              })
            ).toEqual({ liked: true, likes: 1 });
            expect(
              await caller.discussion.toggleLike({
                postId: createdId,
                visitorId: "test-visitor-b",
              })
            ).toEqual({ liked: true, likes: 2 });
            expect(
              await caller.discussion.toggleLike({
                postId: createdId,
                visitorId: "test-visitor-a",
              })
            ).toEqual({ liked: false, likes: 1 });
            posts = await caller.discussion.list({
              visitorId: "test-visitor-b",
            });
            expect(posts.find(p => p.id === createdId)).toMatchObject({
              likes: 1,
              liked: true,
            });

            expect(
              await caller.discussion.addComment({
                postId: createdId,
                author: " 테스트 ",
                content: " 의견입니다. ",
              })
            ).toEqual({ success: true });
            const comments = await caller.discussion.comments({
              postId: createdId,
            });
            expect(comments).toHaveLength(1);
            expect(comments[0]).toMatchObject({
              postId: createdId,
              author: "테스트",
              content: "의견입니다.",
            });
            expect(comments[0].createdAt).toBeInstanceOf(Date);
            posts = await caller.discussion.list();
            expect(posts.find(p => p.id === createdId)).toMatchObject({
              likes: 1,
              comments: 1,
              liked: false,
            });
            throw rollback;
          });
          throw new Error("Expected transaction to roll back");
        } catch (error) {
          if (error !== rollback) throw error;
        }
        const afterRollback = await db
          .select({ id: discussionPosts.id })
          .from(discussionPosts)
          .where(eq(discussionPosts.id, createdId));
        expect(afterRollback).toEqual([]);
      } finally {
        transactionHolder.db = undefined;
        await pool.end();
      }
    },
    30000
  );
});
