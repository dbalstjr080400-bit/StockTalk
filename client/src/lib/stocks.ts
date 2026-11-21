import { STOCK_NAMES } from '@shared/stockCatalog';

export type Stock = { ticker: string; name: string; initials: string; market: string; color: string; background: string; price: string; change: string; line: number[] };

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

export function stockFor(ticker: string) { return STOCKS.find((s) => s.ticker === ticker); }
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
