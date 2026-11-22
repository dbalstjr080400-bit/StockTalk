import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { searchStocks, stockRegion, type Stock, type StockDirectory } from '@/lib/stocks';
import { StockIcon, WatchStar } from './CommunityParts';

const PAGE_SIZE = 30;
const marketNames: Record<string, string> = { KR_ETC: '국내 기타', US_ETC: '미국 기타' };

type Props = {
  stocks: Stock[];
  directory: StockDirectory | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
  query: string;
  onQuery: (query: string) => void;
  watch: string[];
  onToggleWatch: (ticker: string) => void;
  onSelect: (ticker: string) => void;
};

export function StockExplorer({ stocks, directory, loading, error, retry, query, onQuery, watch, onToggleWatch, onSelect }: Props) {
  const [region, setRegion] = useState<'all' | 'kr' | 'us' | 'other'>('all');
  const [market, setMarket] = useState('all');
  const [page, setPage] = useState(1);
  const markets = useMemo(() => Array.from(new Set(stocks.filter((stock) => region === 'all' || stockRegion(stock.market) === region).map((stock) => stock.market))).sort(), [stocks, region]);
  const hasOther = useMemo(() => stocks.some((stock) => stockRegion(stock.market) === 'other'), [stocks]);
  const filtered = useMemo(() => searchStocks(stocks.filter((stock) => (region === 'all' || stockRegion(stock.market) === region) && (market === 'all' || stock.market === market)), query), [stocks, region, market, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageStocks = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const collectedAt = directory ? new Date(directory.asOf).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const regions: { value: 'all' | 'kr' | 'us' | 'other'; label: string }[] = [{ value: 'all', label: '전체' }, { value: 'kr', label: '국내' }, { value: 'us', label: '미국' }, ...(hasOther ? [{ value: 'other' as const, label: '기타' }] : [])];

  return <div className="stock-explore">
    <div className="explore-top"><div><strong>모아의 종목</strong><span>종목을 선택하면 Yahoo Finance 기준 차트와 관련 대화를 볼 수 있어요</span></div><span className="example-pill">시세는 상세에서 조회</span></div>
    {directory && <div className="directory-notice" role="note"><strong>{directory.source === 'kis' ? '한국투자증권 공개 종목 목록 · 토스증권 거래 가능 여부는 다를 수 있어요' : '토스증권 공식 종목 목록'}</strong><span>종목 목록 수집 일시 {collectedAt} · 가격은 종목 상세에서 실시간 조회합니다.</span></div>}
    <div className="explore-filters">
      <label className="explore-search"><Search size={16} /><input value={query} onChange={(event) => { onQuery(event.target.value); setPage(1); }} placeholder="종목명, 영문명 또는 티커 검색" aria-label="종목명, 영문명 또는 티커 검색" /></label>
      <div className="explore-filter-row"><div className="region-filters" aria-label="국가 필터">{regions.map(({ value, label }) => <button key={value} type="button" className={region === value ? 'active' : ''} aria-pressed={region === value} onClick={() => { setRegion(value); setMarket('all'); setPage(1); }}>{label}</button>)}</div><label className="market-filter">시장 <select aria-label="시장 필터" value={market} onChange={(event) => { setMarket(event.target.value); setPage(1); }}><option value="all">전체 시장</option>{markets.map((name) => <option key={name} value={name}>{marketNames[name] ?? name}</option>)}</select></label></div>
    </div>
    {loading ? <div className="feed-state"><span className="loading-pulse" /> 종목 목록을 불러오는 중이에요.</div> : error ? <div className="feed-state" role="alert"><strong>종목 목록을 불러오지 못했어요.</strong><span>잠시 후 다시 시도해 주세요.</span><button onClick={retry}>다시 시도</button></div> : <>
      <div className="explore-count">{query.trim() ? '검색 결과' : '전체 종목'} <strong>{filtered.length.toLocaleString()}개</strong></div>
      {pageStocks.length ? <div className="explore-list">{pageStocks.map((stock, index) => <div className="explore-row" key={`${stock.market}-${stock.ticker}-${index}`}><button className="explore-stock" onClick={() => onSelect(stock.ticker)}><StockIcon stock={stock} /><span><strong>{stock.name}</strong><small>{stock.ticker} · {stock.market}{stock.type ? ` · ${stock.type}` : ''}</small>{stock.englishName && stock.englishName !== stock.name && <small>{stock.englishName}</small>}</span></button><WatchStar active={watch.includes(stock.ticker)} name={stock.name} onClick={() => onToggleWatch(stock.ticker)} /></div>)}</div> : <div className="feed-state">일치하는 종목이 없어요. 검색어나 필터를 바꿔 보세요.</div>}
      {filtered.length > 0 && <div className="explore-pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button><span><strong>{currentPage.toLocaleString()}</strong> / {pages.toLocaleString()} 페이지</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>다음</button></div>}
      <p className="example-disclaimer">종목 상세 차트는 Yahoo Finance 데이터를 기준으로 1분마다 갱신됩니다. 거래 지연과 제공처 이용 약관이 적용될 수 있습니다.</p>
    </>}
  </div>;
}
