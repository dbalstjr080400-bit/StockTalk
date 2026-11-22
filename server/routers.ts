import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
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
  createAdminMessage,
  listAdminMessages,
  updateAdminMessageStatus,
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
  authenticateLocalUser,
  registerLocalUser,
} from "./db";

const postId = z.number().int().positive().max(2147483647);
const PROFANITY_WORDS = ['시발', '씨발', '병신', '새끼', '개새끼', '좆', '년놈', 'fuck', 'shit', 'bitch'];
const containsProfanity = (value: string) => {
  const normalized = value.toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '');
  return PROFANITY_WORDS.some(word => {
    if (/^[a-z]+$/.test(word)) {
      return new RegExp(`(^|[^a-z0-9])${word}(?=$|[^a-z0-9])`, 'i').test(normalized);
    }
    return new RegExp(`(^|[^가-힣])${word}(?=$|[^가-힣])`).test(normalized);
  });
};
const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
      "제어 문자는 사용할 수 없습니다."
    )
    .refine(value => !containsProfanity(value), "욕설이나 부적절한 표현은 사용할 수 없습니다.");
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
    messages: staffProcedure.query(() => listAdminMessages()),
    updateMessageStatus: staffProcedure.input(z.object({ id: postId, status: z.enum(["new", "read", "resolved"]) })).mutation(({ input }) => updateAdminMessageStatus(input.id, input.status)),
    deletePost: adminProcedure.input(z.object({ postId })).mutation(({ input }) => adminDeleteDiscussionPost(input.postId)),
    setSuspended: adminProcedure.input(z.object({ userId: postId, suspended: z.boolean() })).mutation(({ input }) => setUserSuspended(input.userId, input.suspended)),
    setRole: adminProcedure.input(z.object({ userId: postId, role: z.enum(["user", "staff"]) })).mutation(({ input }) => setUserRole(input.userId, input.role)),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({
      loginId: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9._-]+$/, "아이디는 영문·숫자와 . _ -만 사용할 수 있어요."),
      password: z.string().min(8).max(128),
      name: singleLine(40),
      profileNickname: singleLine(40),
    })).mutation(async ({ ctx, input }) => {
      const user = await registerLocalUser(input);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "회원가입을 완료하지 못했어요." });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? user.profileNickname ?? "" });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 365 });
      return { success: true } as const;
    }),
    loginLocal: publicProcedure.input(z.object({ loginId: z.string().trim().min(1).max(80), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const user = await authenticateLocalUser(input.loginId, input.password);
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? user.profileNickname ?? "" });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 24 * 365 });
      return { success: true } as const;
    }),
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
  adminMessages: router({
    create: protectedProcedure.input(z.object({ category: z.enum(["문의", "건의"]), title: singleLine(120), content: plainText(3000) })).mutation(({ ctx, input }) => createAdminMessage({ senderUserId: ctx.user.id, senderName: ctx.user.name ?? ctx.user.profileNickname ?? "회원", senderEmail: ctx.user.email, ...input })),
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
