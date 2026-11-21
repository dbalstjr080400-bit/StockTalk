import { afterEach, describe, expect, it, vi } from "vitest";

const originalId = process.env.TOSS_CLIENT_ID;
const originalSecret = process.env.TOSS_CLIENT_SECRET;
afterEach(() => {
  if (originalId === undefined) delete process.env.TOSS_CLIENT_ID; else process.env.TOSS_CLIENT_ID = originalId;
  if (originalSecret === undefined) delete process.env.TOSS_CLIENT_SECRET; else process.env.TOSS_CLIENT_SECRET = originalSecret;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("stock directory", () => {
  it("uses the clearly labelled KIS snapshot when Toss credentials are absent", async () => {
    delete process.env.TOSS_CLIENT_ID;
    delete process.env.TOSS_CLIENT_SECRET;
    const { getStockDirectory } = await import("./stocks");
    const data = await getStockDirectory();
    expect(data.source).toBe("kis");
    expect(data.items.length).toBeGreaterThan(10_000);
    expect(data.items.find(s => s.symbol === "005930" && s.market === "KOSPI")?.name).toBe("삼성전자");
    expect(data.items.find(s => s.symbol === "AAPL" && s.market === "NASDAQ")?.name).toBe("애플");
  });

  it("queries every supported Toss market before calling the result official", async () => {
    process.env.TOSS_CLIENT_ID = "test-client";
    process.env.TOSS_CLIENT_SECRET = "test-secret";
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/oauth2/token")) return Response.json({ access_token: "test-token" });
      const market = new URL(url).searchParams.get("market");
      const result = market === "KOSPI"
        ? [{ symbol: "005930", name: "삼성전자", securityType: "STOCK" }]
        : market === "NASDAQ" ? [{ symbol: "AAPL", name: "애플", securityType: "STOCK" }] : [];
      return Response.json({ result });
    }));
    const { getStockDirectory } = await import("./stocks");
    const data = await getStockDirectory();
    expect(data.source).toBe("toss");
    expect(data.items.map(s => s.symbol)).toEqual(["005930", "AAPL"]);
    expect(requests).toHaveLength(8);
    expect(new Set(requests.slice(1).map(url => new URL(url).searchParams.get("market"))).size).toBe(7);
    expect(JSON.stringify(data)).not.toContain("test-token");
  }, 15_000);

  it("does not label fallback data as Toss data when authentication fails", async () => {
    process.env.TOSS_CLIENT_ID = "test-client";
    process.env.TOSS_CLIENT_SECRET = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getStockDirectory } = await import("./stocks");
    const data = await getStockDirectory();
    expect(data.source).toBe("kis");
    expect(data.items.length).toBeGreaterThan(10_000);
  });
});
