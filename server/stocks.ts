import { readFile } from "node:fs/promises";
import path from "node:path";

export type Market = "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "AMEX" | "KR_ETC" | "US_ETC";
type Stock = { symbol: string; name: string; englishName?: string; market: Market; type: string };
type Directory = { source: "toss" | "kis"; asOf: string; items: Stock[] };

const MARKETS: Market[] = ["KOSPI", "KOSDAQ", "NASDAQ", "NYSE", "AMEX", "KR_ETC", "US_ETC"];
const TYPE_LABELS: Record<string, string> = {
  STOCK: "주식", FOREIGN_STOCK: "해외주식", DEPOSITARY_RECEIPT: "DR",
  INFRASTRUCTURE_FUND: "인프라펀드", REIT: "리츠", ETF: "ETF", FOREIGN_ETF: "ETF",
  ETN: "ETN", STOCK_WARRANTS: "워런트",
};
const CACHE_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;
let cache: Directory | undefined;
let cacheUntil = 0;
let nextAttempt = 0;
let inflight: Promise<Directory> | undefined;

/** Use one server-side token and never expose credentials or tokens to the browser. */
async function fetchTossDirectory(clientId: string, clientSecret: string): Promise<Directory> {
  const tokenResponse = await fetch("https://openapi.tossinvest.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!tokenResponse.ok) throw new Error(`토스 인증 실패 (${tokenResponse.status})`);
  const tokenBody = await tokenResponse.json() as { access_token?: unknown };
  if (typeof tokenBody.access_token !== "string" || !tokenBody.access_token) throw new Error("토스 인증 응답 오류");

  const items: Stock[] = [];
  for (const [index, market] of MARKETS.entries()) {
    const url = new URL("https://openapi.tossinvest.com/api/v1/stocks/all");
    url.searchParams.set("market", market);
    let response = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = Number(retryAfter);
      const parsedDate = retryAfter ? Date.parse(retryAfter) : NaN;
      const delay = retryAfter && Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000
        : Number.isFinite(parsedDate) ? Math.max(0, parsedDate - Date.now()) : 2_000;
      if (delay > 10_000) throw new Error("토스 조회 요청 제한");
      await new Promise(resolve => setTimeout(resolve, delay));
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` },
        signal: AbortSignal.timeout(12_000),
      });
    }
    if (!response.ok) throw new Error(`토스 종목 조회 실패 (${response.status})`);
    const payload = await response.json() as { result?: unknown };
    if (!Array.isArray(payload.result)) throw new Error("토스 종목 응답 오류");
    for (const raw of payload.result) {
      if (typeof raw?.symbol !== "string" || typeof raw?.name !== "string" || !raw.symbol || !raw.name) {
        throw new Error("토스 종목 형식 오류");
      }
      items.push({ symbol: raw.symbol, name: raw.name, market, type: TYPE_LABELS[raw.securityType] ?? "기타" });
    }
    // Keep requests below one per second; the provider can impose stricter limits.
    if (index < MARKETS.length - 1) await new Promise(resolve => setTimeout(resolve, 1_100));
  }
  if (!items.some(s => s.market === "KOSPI") || !items.some(s => s.market === "NASDAQ")) {
    throw new Error("토스 종목 목록이 불완전합니다");
  }
  // The existing community identifies posts and watchlists by ticker alone.
  // Do not silently merge different market instruments if a feed has collisions.
  if (new Set(items.map(item => item.symbol)).size !== items.length) {
    throw new Error("시장별 중복 종목 코드가 있어 목록을 안전하게 연결할 수 없습니다");
  }
  return { source: "toss", asOf: new Date().toISOString(), items };
}

async function readFallback(): Promise<Directory> {
  const publicDir = process.env.NODE_ENV === "production" ? "dist/public" : "client/public";
  const contents = await readFile(path.join(process.cwd(), publicDir, "data/stock-snapshot.json"), "utf8");
  const directory = JSON.parse(contents) as Directory;
  if (directory.source !== "kis" || !Array.isArray(directory.items) || !directory.items.length) {
    throw new Error("공개 종목 목록을 불러올 수 없습니다");
  }
  return directory;
}

export async function getStockDirectory(): Promise<Directory> {
  const clientId = process.env.TOSS_CLIENT_ID;
  const clientSecret = process.env.TOSS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return readFallback();
  const now = Date.now();
  if (cache && now < cacheUntil) return cache;
  if (cache && now < nextAttempt) return cache;
  if (now < nextAttempt) return readFallback();
  if (!inflight) {
    inflight = fetchTossDirectory(clientId, clientSecret).then(data => {
      cache = data;
      cacheUntil = Date.now() + CACHE_MS;
      nextAttempt = 0;
      return data;
    }).catch(async () => {
      nextAttempt = Date.now() + RETRY_MS;
      // If a refresh fails, retain the last complete official directory, with its original date.
      return cache ?? await readFallback();
    }).finally(() => { inflight = undefined; });
  }
  return inflight;
}
