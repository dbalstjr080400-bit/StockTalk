export type MarketIndex = {
  ticker: string;
  name: string;
  englishName: string;
  market: string;
  description: string;
  source: string;
  sourceUrl: string;
};

// Index tickers are stable community identifiers. Quote pages remain the source of truth for live values.
export const MARKET_INDICES: readonly MarketIndex[] = [
  { ticker: 'KOSPI', name: '코스피', englishName: 'KOSPI Composite', market: '국내지수', description: '한국거래소 유가증권시장 대표 지수', source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/%5EKS11/' },
  { ticker: 'KOSDAQ', name: '코스닥', englishName: 'KOSDAQ Composite', market: '국내지수', description: '성장주 중심의 국내 대표 지수', source: 'Daum 금융', sourceUrl: 'https://m.finance.daum.net/index' },
  { ticker: 'NASDAQ', name: '나스닥 종합', englishName: 'NASDAQ Composite', market: '미국지수', description: '미국 기술주와 성장주 흐름을 보여주는 지수', source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/%5EIXIC/' },
  { ticker: 'SP500', name: 'S&P 500', englishName: 'S&P 500', market: '미국지수', description: '미국 대형주 500개로 구성된 대표 지수', source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/%5EGSPC/' },
  { ticker: 'DOW30', name: '다우존스', englishName: 'Dow Jones Industrial Average', market: '미국지수', description: '미국 주요 우량 기업 흐름을 보는 지수', source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/%5EDJI/' },
  { ticker: 'VIX', name: 'VIX 공포지수', englishName: 'CBOE Volatility Index', market: '변동성', description: '미국 주식시장 변동성 기대를 보여주는 지표', source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/%5EVIX/' },
  { ticker: 'BTC', name: '비트코인', englishName: 'Bitcoin USD', market: '가상자산', description: '대표 가상자산의 달러 기준 흐름', source: 'Nasdaq', sourceUrl: 'https://www.nasdaq.com/market-activity/cryptocurrency/btc' },
  { ticker: 'GOLD', name: '금 선물', englishName: 'Gold Futures', market: '원자재', description: '대표 안전자산인 금 가격 흐름', source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/GC%3DF/' },
  { ticker: 'OIL', name: 'WTI 원유', englishName: 'Crude Oil Futures', market: '원자재', description: '글로벌 물가와 경기의 주요 변수인 유가', source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/CL%3DF/' },
];

export const MARKET_INDEX_TICKERS = new Set(MARKET_INDICES.map((index) => index.ticker));
export function isMarketIndex(ticker: string) { return MARKET_INDEX_TICKERS.has(ticker); }
