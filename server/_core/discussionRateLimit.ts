import { TRPCError } from '@trpc/server';
import { publicProcedure } from './trpc';

// A best-effort, per-process network throttle for anonymous writes. It is not an
// identity system; shared proxies may share a bucket and restarts reset it.
const buckets = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 60_000;
const LIMITS: Record<string, number> = {
  'discussion.create': 60,
  'discussion.addComment': 120,
  'discussion.toggleLike': 300,
};

export const limitedDiscussionWrite = publicProcedure.use(({ ctx, path, next }) => {
  const now = Date.now();
  const address = ctx.req.ip || ctx.req.socket?.remoteAddress || 'unknown';
  const key = `${address}:${path}`;
  const limit = LIMITS[path] ?? 60;
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  if (bucket.count >= limit) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' });
  }
  bucket.count += 1;
  if (buckets.size > 5000) {
    for (const [entry, value] of buckets) if (now - value.start >= WINDOW_MS) buckets.delete(entry);
  }
  return next();
});
