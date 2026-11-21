import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createDiscussionPost: vi.fn().mockResolvedValue(42),
  listDiscussionPosts: vi.fn(),
  addDiscussionComment: vi.fn(),
  getDiscussionComments: vi.fn(),
  toggleDiscussionLike: vi.fn(),
}));

import { createDiscussionPost } from "./db";
import { appRouter } from "./routers";
import { getStockDirectory } from "./stocks";

const caller = appRouter.createCaller({
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});
const post = { category: "자유토론", title: "종목 이야기", content: "테스트 내용", author: "테스터" };

describe("discussion stock catalogue", () => {
  it("allows a stock beyond the original example list", async () => {
    const result = await caller.discussion.create({ ...post, ticker: "323410", stockName: "카카오뱅크" });
    expect(result).toBe(42);
    expect(createDiscussionPost).toHaveBeenCalledWith(expect.objectContaining({ ticker: "323410" }));
  });

  it("allows the provider's slash-containing symbols", async () => {
    const directory = await getStockDirectory();
    const stock = directory.items.find(s => s.symbol.includes("/"));
    expect(stock).toBeDefined();
    const result = await caller.discussion.create({ ...post, ticker: stock!.symbol, stockName: stock!.name });
    expect(result).toBe(42);
  });

  it("rejects a real code paired with a different name", async () => {
    await expect(caller.discussion.create({ ...post, ticker: "323410", stockName: "삼성전자" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
