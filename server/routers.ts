import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { limitedDiscussionWrite } from "./_core/discussionRateLimit";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router, staffProcedure } from "./_core/trpc";
import { getStockDirectory } from "./stocks";
import { isMarketIndex } from "@shared/marketIndices";
import {
  addDiscussionComment,
  adminDeleteDiscussionPost,
  createDiscussionPost,
  deleteDiscussionPost,
  deleteDiscussionComment,
  getDiscussionComments,
  getAdminSnapshot,
  incrementDiscussionViews,
  getFollowStatus,
  getPublicProfileByNickname,
  searchUserNicknames,
  followUser,
  unfollowUser,
  listNotifications,
  listDiscussionPosts,
  markAllNotificationsRead,
  markNotificationRead,
  reportDiscussionPost,
  setUserRole,
  setUserSuspended,
  toggleDiscussionLike,
  updateUserNickname,
  updateDiscussionComment,
  updateDiscussionPost,
} from "./db";

const postId = z.number().int().positive().max(2147483647);
const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
      "제어 문자는 사용할 수 없습니다."
    );
const singleLine = (max: number) =>
  plainText(max).refine(
    value => !/[\r\n\t]/.test(value),
    "한 줄로 입력해 주세요."
  );
const visitorId = singleLine(128);

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  admin: router({
    snapshot: staffProcedure.query(() => getAdminSnapshot()),
    deletePost: adminProcedure.input(z.object({ postId })).mutation(({ input }) => adminDeleteDiscussionPost(input.postId)),
    setSuspended: adminProcedure.input(z.object({ userId: postId, suspended: z.boolean() })).mutation(({ input }) => setUserSuspended(input.userId, input.suspended)),
    setRole: adminProcedure.input(z.object({ userId: postId, role: z.enum(["user", "staff"]) })).mutation(({ input }) => setUserRole(input.userId, input.role)),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    updateNickname: protectedProcedure.input(z.object({ nickname: singleLine(40) })).mutation(({ ctx, input }) => updateUserNickname(ctx.user.id, input.nickname)),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ notificationId: postId })).mutation(({ ctx, input }) => markNotificationRead(ctx.user.id, input.notificationId)),
    markAllRead: protectedProcedure.mutation(({ ctx }) => markAllNotificationsRead(ctx.user.id)),
  }),
  profile: router({
    byNickname: publicProcedure.input(z.object({ nickname: singleLine(40) })).query(({ input }) => getPublicProfileByNickname(input.nickname)),
    search: publicProcedure.input(z.object({ query: z.string().max(40) })).query(({ input }) => searchUserNicknames(input.query)),
  }),
  follows: router({
    status: protectedProcedure.input(z.object({ userId: postId })).query(({ ctx, input }) => getFollowStatus(ctx.user.id, input.userId)),
    follow: protectedProcedure.input(z.object({ userId: postId })).mutation(({ ctx, input }) => followUser(ctx.user.id, input.userId)),
    unfollow: protectedProcedure.input(z.object({ userId: postId })).mutation(({ ctx, input }) => unfollowUser(ctx.user.id, input.userId)),
  }),

  discussion: router({
    list: publicProcedure
      .input(z.object({ visitorId: visitorId.optional() }).optional())
      .query(({ input }) => listDiscussionPosts(input?.visitorId)),
    create: limitedDiscussionWrite
      .input(
        z.object({
          ticker: singleLine(32).regex(
            /^[A-Za-z0-9._\/-]+$/,
            "올바른 종목 코드를 입력해 주세요."
          ),
          stockName: singleLine(100),
          category: singleLine(30),
          title: singleLine(120),
          content: plainText(5000),
          author: singleLine(40),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const directory = await getStockDirectory();
        const isDirectoryStock = directory.items.some(stock => stock.symbol === input.ticker && stock.name === input.stockName);
        const isIndex = isMarketIndex(input.ticker);
        if (!isDirectoryStock && !isIndex) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "등록된 종목 코드와 이름을 선택해 주세요." });
        }
        return createDiscussionPost({ ...input, authorUserId: ctx.user?.id });
      }),
    update: limitedDiscussionWrite
      .input(z.object({ postId, author: singleLine(40), title: singleLine(120), content: plainText(5000) }))
      .mutation(({ input }) => updateDiscussionPost(input)),
    remove: limitedDiscussionWrite
      .input(z.object({ postId, author: singleLine(40) }))
      .mutation(({ input }) => deleteDiscussionPost(input.postId, input.author)),
    report: limitedDiscussionWrite
      .input(z.object({ postId, reporter: singleLine(40), reason: singleLine(200) }))
      .mutation(({ input }) => reportDiscussionPost(input)),
    incrementViews: publicProcedure
      .input(z.object({ postId }))
      .mutation(({ input }) => incrementDiscussionViews(input.postId)),
    toggleLike: limitedDiscussionWrite
      .input(z.object({ postId, visitorId }))
      .mutation(({ input, ctx }) =>
        toggleDiscussionLike(input.postId, input.visitorId, ctx.user?.id)
      ),
    comments: publicProcedure
      .input(z.object({ postId }))
      .query(({ input }) => getDiscussionComments(input.postId)),
    addComment: limitedDiscussionWrite
      .input(
        z.object({ postId, parentCommentId: postId.optional(), author: singleLine(40), content: plainText(1000) })
      )
      .mutation(({ input, ctx }) => addDiscussionComment({ ...input, authorUserId: ctx.user?.id })),
    updateComment: limitedDiscussionWrite
      .input(z.object({ commentId: postId, author: singleLine(40), content: plainText(1000) }))
      .mutation(({ input }) => updateDiscussionComment(input)),
    removeComment: limitedDiscussionWrite
      .input(z.object({ commentId: postId, author: singleLine(40) }))
      .mutation(({ input }) => deleteDiscussionComment(input.commentId, input.author)),
    reportComment: limitedDiscussionWrite
      .input(z.object({ postId, commentId: postId, reporter: singleLine(40), reason: singleLine(200) }))
      .mutation(({ input }) => reportDiscussionPost(input)),
  }),
});

export type AppRouter = typeof appRouter;
