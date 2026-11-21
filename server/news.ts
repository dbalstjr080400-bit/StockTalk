type NewsSourceConfig = {
  source: string;
  url: string;
  ranking: string;
  match: (href: string) => boolean;
};

export type NewsHeadline = {
  source: string;
  sourceUrl: string;
  ranking: string;
  title: string;
  summary?: string;
  url: string;
};

const SOURCES: NewsSourceConfig[] = [
  { source: "네이버 증권", url: "https://finance.naver.com/news/news_list.naver?mode=RANK", ranking: "많이 본 뉴스", match: href => href.includes("news_read.naver") },
  { source: "다음 금융", url: "https://m.finance.daum.net/news", ranking: "많이 본 뉴스", match: href => href.includes("v.daum.net/v/") },
  { source: "BBC Business", url: "https://www.bbc.com/business", ranking: "공식 주요 노출", match: href => href.includes("bbc.com/news/articles/") },
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/news/", ranking: "Yahoo Finance 주요 뉴스", match: href => href.includes("finance.yahoo.com/news/") && !href.includes("/video/") },
  { source: "CNBC Markets", url: "https://www.cnbc.com/markets/", ranking: "Trending Now", match: href => href.includes("cnbc.com/") && /20\d\d\//.test(href) },
];

let cached: { expiresAt: number; items: NewsHeadline[] } | null = null;

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadlines(html: string, config: NewsSourceConfig) {
  const items: NewsHeadline[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const rawHref = match[1];
    const anchorHtml = match[2];
    const headingMatch = anchorHtml.match(/<(?:h[1-6]|strong)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong)>/i);
    const summaryMatch = anchorHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const title = cleanText(headingMatch?.[1] ?? anchorHtml);
    const summary = cleanText(summaryMatch?.[1] ?? "");
    let url: string;
    try { url = new URL(rawHref, config.url).toString(); } catch { continue; }
    if (!rawHref || !config.match(url) || title.length < 12 || title.length > 240) continue;
    if (/^(skip to|financial news|personal finance|my portfolio|highest dividend|most expensive|highest beta|unusual volume)/i.test(title)) continue;
    if (url.endsWith("/news/") || url.includes("#navigation") || url.includes("#nimbus") || url.includes("#right-rail")) continue;
    const key = `${config.source}:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ source: config.source, sourceUrl: config.url, ranking: config.ranking, title, summary: summary && summary !== title ? summary.slice(0, 260) : undefined, url });
    if (items.length >= 6) break;
  }
  return items;
}

async function fetchSource(config: NewsSourceConfig): Promise<NewsHeadline[]> {
  try {
    const response = await fetch(config.url, { headers: { "user-agent": "StockTalk News Headlines/1.0" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return [];
    return extractHeadlines(await response.text(), config);
  } catch {
    return [];
  }
}

export async function getNewsHeadlines() {
  if (cached && cached.expiresAt > Date.now()) return cached.items;
  const results = await Promise.all(SOURCES.map(fetchSource));
  const items = results.flat();
  cached = { expiresAt: Date.now() + 15 * 60 * 1000, items };
  return items;
}
