import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, ExternalLink, MessageCircle, Newspaper, Plus, X } from 'lucide-react';
import { PostCard, StockIcon, type Post } from './CommunityParts';
import type { Stock } from '@/lib/stocks';
import { MARKET_INDICES, type MarketIndex } from '@shared/marketIndices';

type NewsSource = { name: string; description: string; url: string; tone: string };
const NEWS_SOURCES: NewsSource[] = [
  { name: '네이버 증권', description: '실시간 속보·주요 뉴스·해외 뉴스·공시', url: 'https://stock.naver.com/news', tone: 'NAVER' },
  { name: '다음 금융', description: '국내·해외 시장 뉴스와 종목별 뉴스', url: 'https://m.finance.daum.net/news', tone: 'DAUM' },
  { name: 'BBC Business', description: '글로벌 기업·경제·시장 동향', url: 'https://www.bbc.com/business', tone: 'BBC' },
  { name: 'Yahoo Finance', description: '미국 시장·지수·기업 뉴스와 시세', url: 'https://finance.yahoo.com/news/', tone: 'YAHOO' },
  { name: 'CNBC Markets', description: '미국·글로벌 시장의 주요 움직임', url: 'https://www.cnbc.com/markets/', tone: 'CNBC' },
  { name: 'Reuters Business', description: '글로벌 경제·기업·금융시장 전문 뉴스', url: 'https://www.reuters.com/business/', tone: 'REUTERS' },
  { name: 'Financial Times Markets', description: '세계 금융시장·거시경제·기업 분석', url: 'https://www.ft.com/markets', tone: 'FT' },
  { name: 'MarketWatch', description: '미국 증시·채권·금리·시장 데이터 뉴스', url: 'https://www.marketwatch.com/', tone: 'MW' },
];

type NewsHeadline = { source: string; sourceUrl: string; ranking: string; title: string; summary?: string; url: string };

type IndexQuote = { price: string; change: string; positive: boolean; points: number[] };
const INDEX_QUOTES: Record<string, IndexQuote> = {
  KOSPI: { price: '2,745.32', change: '+0.84%', positive: true, points: [42, 39, 41, 37, 34, 35, 30, 32, 27, 25] },
  KOSDAQ: { price: '812.45', change: '+0.56%', positive: true, points: [35, 38, 34, 36, 31, 29, 32, 28, 26, 24] },
  NASDAQ: { price: '18,352.76', change: '+1.12%', positive: true, points: [45, 42, 43, 36, 38, 31, 33, 27, 29, 22] },
  SP500: { price: '5,918.25', change: '+0.42%', positive: true, points: [40, 38, 39, 35, 36, 32, 34, 29, 30, 26] },
  DOW30: { price: '43,408.47', change: '-0.18%', positive: false, points: [24, 27, 25, 29, 31, 30, 34, 32, 36, 38] },
  VIX: { price: '15.34', change: '-3.22%', positive: false, points: [22, 25, 24, 29, 27, 31, 28, 34, 32, 36] },
  BTC: { price: '$98,420.00', change: '+2.18%', positive: true, points: [48, 45, 47, 42, 44, 37, 39, 31, 34, 26] },
  GOLD: { price: '$2,658.40', change: '+0.31%', positive: true, points: [36, 34, 35, 32, 31, 28, 30, 27, 25, 23] },
  OIL: { price: '$69.12', change: '-1.05%', positive: false, points: [25, 27, 26, 29, 31, 30, 33, 35, 34, 38] },
};

function IndexMiniChart({ points, positive }: Pick<IndexQuote, 'points' | 'positive'>) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((point, index) => `${(index / (points.length - 1)) * 116},${30 - ((point - min) / range) * 24}`).join(' ');
  return <svg className={`index-mini-chart ${positive ? 'positive' : 'negative'}`} viewBox="0 0 116 34" role="img" aria-label="최근 흐름 그래프"><polyline points={path} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function NewsSection() {
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState(NEWS_SOURCES[0].name);

  useEffect(() => {
    let active = true;
    fetch('/api/news')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('news request failed')))
      .then(payload => { if (active) setHeadlines(payload.headlines ?? []); })
      .catch(() => { if (active) setHeadlines([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section className="market-content" aria-label="주요뉴스 목록">
    <div className="market-source-note"><Newspaper size={17} /><span>헤드라인만 공식 페이지에서 수집합니다. 제목을 누르면 각 언론사의 원문으로 이동합니다.</span></div>
    <nav className="news-publisher-tabs" aria-label="뉴스 언론사 선택">{NEWS_SOURCES.map((source) => <button type="button" key={source.name} className={activeSource === source.name ? 'active' : ''} onClick={() => setActiveSource(source.name)}>{source.tone}</button>)}</nav>
    <div className="news-source-grid">{NEWS_SOURCES.filter(source => source.name === activeSource).map((source) => {
      const sourceHeadlines = headlines.filter(item => item.source === source.name);
      return <article className="news-source-card" key={source.name}>
        <a className="news-source-heading" href={source.url} target="_blank" rel="noopener noreferrer"><span className="market-card-kicker">{source.tone}</span><strong>{source.name}</strong><p>{source.description}</p></a>
        <span className="news-ranking-note">{sourceHeadlines[0]?.ranking ?? (source.name === '네이버 증권' || source.name === '다음 금융' ? '많이 본 뉴스' : '공식 뉴스')}</span>
        {loading && <p className="news-loading">헤드라인을 불러오는 중입니다…</p>}
        {!loading && sourceHeadlines.length === 0 && <a className="market-card-link" href={source.url} target="_blank" rel="noopener noreferrer">공식 뉴스 보기 <ExternalLink size={13} /></a>}
        {!loading && sourceHeadlines.length > 0 && <ol className="news-headline-list">{sourceHeadlines.map((item, index) => <li key={`${item.url}-${index}`}><a href={item.url} target="_blank" rel="noopener noreferrer"><span>{index + 1}</span><strong>{item.title}</strong><ExternalLink size={13} />{item.summary && <small>{item.summary}</small>}</a></li>)}</ol>}
      </article>;
    })}</div>
  </section>;
}

type IndexSectionProps = {
  selected: MarketIndex | undefined;
  posts: Post[];
  indexStocks: Stock[];
  onSelect: (index: MarketIndex) => void;
  onClose: () => void;
  onWrite: () => void;
  onLike: (post: Post) => void;
  onComments: (post: Post) => void;
  currentAuthor?: string;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  onReport: (post: Post) => void;
};

export function IndexSection({ selected, posts, indexStocks, onSelect, onClose, onWrite, onLike, onComments, currentAuthor, onEdit, onDelete, onReport }: IndexSectionProps) {
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const stockForIndex = (index: MarketIndex) => indexStocks.find((stock) => stock.ticker === index.ticker) as Stock;
  const visiblePosts = useMemo(() => {
    const periodMs = period === 'day' ? 24 * 60 * 60 * 1000 : period === 'week' ? 7 * 24 * 60 * 60 * 1000 : period === 'month' ? 30 * 24 * 60 * 60 * 1000 : Infinity;
    const scoped = sort === 'popular' && periodMs !== Infinity ? posts.filter((post) => Date.now() - new Date(post.createdAt).getTime() <= periodMs) : posts;
    return [...scoped].sort((a, b) => sort === 'popular' ? b.views - a.views || b.likes - a.likes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [period, posts, sort]);
  return <section className="market-content" aria-label="주요지수 목록">
    <div className="market-source-note"><BarChart3 size={17} /><span>지수 값과 변동률은 지연될 수 있습니다. 각 카드의 공식 시세 페이지에서 최신 값을 확인하세요.</span></div>
    <div className="index-grid">{MARKET_INDICES.map((index) => { const quote = INDEX_QUOTES[index.ticker]; return <article className={`index-card ${selected?.ticker === index.ticker ? 'selected' : ''}`} key={index.ticker}>
      <button className="index-card-main" onClick={() => onSelect(index)}><span className="market-card-kicker">{index.market}</span><strong>{index.name}</strong><span>{index.englishName}</span>{quote && <div className="index-quote"><div><b>{quote.price}</b><em className={quote.positive ? 'up' : 'down'}>{quote.change}</em></div><IndexMiniChart points={quote.points} positive={quote.positive} /></div>}<p>{index.description}</p></button>
      <div className="index-card-actions"><a href={index.sourceUrl} target="_blank" rel="noopener noreferrer">시세 보기 <ArrowUpRight size={13} /></a><button onClick={() => onSelect(index)}><MessageCircle size={13} /> 게시판 열기</button></div>
    </article>; })}</div>
    {selected && <div className="index-board-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="index-board index-board-modal" role="dialog" aria-modal="true" aria-label={`${selected.name} 게시판`}><div className="index-board-heading"><div><span className="market-card-kicker">{selected.market}</span><h3>{selected.name} 게시판 <span className="index-board-post-count">{visiblePosts.length}</span></h3><p>{selected.name}에 관한 글과 의견을 이 게시판에서 나눠보세요.</p></div><div className="index-board-actions"><button className="index-board-close" onClick={onClose} aria-label="게시판 닫기"><X size={19} /></button></div></div><div className="index-board-sort"><div className="index-sort-tabs"><button className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>최신순</button><button className={sort === 'popular' ? 'active' : ''} onClick={() => setSort('popular')}>인기순</button></div>{sort === 'popular' && <div className="index-period-tabs"><button className={period === 'all' ? 'active' : ''} onClick={() => setPeriod('all')}>전체</button><button className={period === 'day' ? 'active' : ''} onClick={() => setPeriod('day')}>1일</button><button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>1주</button><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>1개월</button></div>}</div>
      {visiblePosts.length ? <div className="feed-list">{visiblePosts.map((post) => <PostCard key={post.id} post={post} stock={stockForIndex(selected)} onLike={() => onLike(post)} onComments={() => onComments(post)} onStock={() => onSelect(selected)} currentAuthor={currentAuthor} onEdit={() => onEdit(post)} onDelete={() => onDelete(post)} onReport={() => onReport(post)} />)}</div> : <div className="feed-state"><MessageCircle size={24} /><strong>아직 {selected.name} 이야기가 없어요.</strong><span>이 지수의 첫 글을 작성해 보세요.</span></div>}<button className="index-board-compose" onClick={onWrite} aria-label={`${selected.name} 게시판 글쓰기`}><Plus size={23} /></button>
    </section></div>}
  </section>;
}
