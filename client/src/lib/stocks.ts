import { STOCK_NAMES } from '@shared/stockCatalog';

export type Stock = {
  ticker: string;
  name: string;
  englishName?: string;
  market: string;
  type?: string;
  initials: string;
  color: string;
  background: string;
  // Only the seven original display examples have these fields. They are not quotes.
  price?: string;
  change?: string;
  line?: number[];
};
export type StockDirectoryItem = { symbol: string; name: string; englishName?: string; market: string; type: string };
export type StockDirectory = { source: 'kis' | 'toss'; asOf: string; items: StockDirectoryItem[] };

// These are display examples, not quotes from a market data provider.
export const STOCKS: Stock[] = [
  { ticker: '005930', name: '삼성전자', initials: 'S', market: 'KOSPI', color: '#315ecb', background: '#eaf0ff', price: '74,800', change: '+1.22%', line: [5, 7, 6, 9, 8, 11, 10, 13] },
  { ticker: '000660', name: 'SK하이닉스', initials: 'SK', market: 'KOSPI', color: '#e77043', background: '#fff0e9', price: '192,500', change: '+2.31%', line: [3, 5, 4, 7, 6, 9, 8, 12] },
  { ticker: 'NVDA', name: '엔비디아', initials: 'N', market: 'NASDAQ', color: '#629d21', background: '#eff8e6', price: '128.20', change: '+1.84%', line: [4, 6, 5, 8, 7, 10, 9, 13] },
  { ticker: 'TSLA', name: '테슬라', initials: 'T', market: 'NASDAQ', color: '#df5558', background: '#fff0ef', price: '248.50', change: '-0.63%', line: [11, 9, 10, 8, 9, 6, 7, 5] },
  { ticker: '035420', name: 'NAVER', initials: 'N', market: 'KOSPI', color: '#05a86b', background: '#e6f8f0', price: '181,300', change: '+0.72%', line: [3, 5, 4, 6, 8, 7, 9, 10] },
  { ticker: 'AAPL', name: '애플', initials: 'A', market: 'NASDAQ', color: '#4f5969', background: '#edf0f3', price: '231.45', change: '+0.48%', line: [4, 5, 6, 5, 7, 9, 8, 10] },
  { ticker: '035720', name: '카카오', initials: 'K', market: 'KOSPI', color: '#6f6023', background: '#fff7d5', price: '43,250', change: '-0.34%', line: [10, 9, 8, 9, 7, 8, 7, 6] },
].map((stock) => ({ ...stock, name: STOCK_NAMES[stock.ticker] ?? stock.name }));

const examplesByTicker = new Map(STOCKS.map((stock) => [stock.ticker, stock]));
export function stockFor(ticker: string) { return examplesByTicker.get(ticker); }

/** Keep the API's name and symbol intact; add only visual/sample metadata for known examples. */
export function stockFromDirectory(item: StockDirectoryItem): Stock {
  const example = stockFor(item.symbol);
  return {
    ...example,
    ticker: item.symbol,
    name: item.name,
    englishName: item.englishName,
    market: item.market,
    type: item.type,
    initials: example?.initials ?? (item.symbol.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '•'),
    color: example?.color ?? '#566479',
    background: example?.background ?? '#eef1f5',
  };
}

export function stockRegion(market: string): 'kr' | 'us' | 'other' {
  if (['KOSPI', 'KOSDAQ', 'KR_ETC'].includes(market) || market.startsWith('KR_')) return 'kr';
  if (['NASDAQ', 'NYSE', 'AMEX', 'US_ETC'].includes(market) || market.startsWith('US_')) return 'us';
  return 'other';
}

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
/** Exact matches first, then prefixes, then substring matches; preserves original order within a rank. */
export function searchStocks(stocks: Stock[], query: string): Stock[] {
  const term = normalize(query.trim());
  if (!term) return stocks;
  return stocks.map((stock, index) => {
    const example = stockFor(stock.ticker);
    const fields = [stock.name, stock.ticker, stock.englishName ?? '', example?.name ?? ''].map(normalize);
    const score = fields.some((field) => field === term) ? 0 : fields.some((field) => field.startsWith(term)) ? 1 : fields.some((field) => field.includes(term)) ? 2 : 3;
    return { stock, score, index };
  }).filter((result) => result.score < 3).sort((a, b) => a.score - b.score || a.index - b.index).map((result) => result.stock);
}

export function relativeTime(date: Date | string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return '방금 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(date).toLocaleDateString('ko-KR');
}
