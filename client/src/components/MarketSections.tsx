import { useEffect, useRef } from 'react';
import { ArrowUpRight, BarChart3, ExternalLink, MessageCircle, Newspaper, PenLine } from 'lucide-react';
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
];

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
  return <section className="market-content" aria-label="주요뉴스 목록">
    <div className="market-source-note"><Newspaper size={17} /><span>기사 원문과 최신 업데이트는 각 언론사 공식 페이지에서 확인하세요.</span></div>
    <div className="news-source-grid">{NEWS_SOURCES.map((source) => <a className="news-source-card" href={source.url} target="_blank" rel="noopener noreferrer" key={source.name}>
      <span className="market-card-kicker">{source.tone}</span><strong>{source.name}</strong><p>{source.description}</p><span className="market-card-link">공식 뉴스 보기 <ExternalLink size={13} /></span>
    </a>)}</div>
  </section>;
}

type IndexSectionProps = {
  selected: MarketIndex | undefined;
  posts: Post[];
  indexStocks: Stock[];
  onSelect: (index: MarketIndex) => void;
  onWrite: () => void;
  onLike: (post: Post) => void;
  onComments: (post: Post) => void;
};

export function IndexSection({ selected, posts, indexStocks, onSelect, onWrite, onLike, onComments }: IndexSectionProps) {
  const stockForIndex = (index: MarketIndex) => indexStocks.find((stock) => stock.ticker === index.ticker) as Stock;
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    requestAnimationFrame(() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [selected?.ticker]);
  return <section className="market-content" aria-label="주요지수 목록">
    <div className="market-source-note"><BarChart3 size={17} /><span>지수 값과 변동률은 지연될 수 있습니다. 각 카드의 공식 시세 페이지에서 최신 값을 확인하세요.</span></div>
    <div className="index-grid">{MARKET_INDICES.map((index) => { const quote = INDEX_QUOTES[index.ticker]; return <article className={`index-card ${selected?.ticker === index.ticker ? 'selected' : ''}`} key={index.ticker}>
      <button className="index-card-main" onClick={() => onSelect(index)}><span className="market-card-kicker">{index.market}</span><strong>{index.name}</strong><span>{index.englishName}</span>{quote && <div className="index-quote"><div><b>{quote.price}</b><em className={quote.positive ? 'up' : 'down'}>{quote.change}</em></div><IndexMiniChart points={quote.points} positive={quote.positive} /></div>}<p>{index.description}</p></button>
      <div className="index-card-actions"><a href={index.sourceUrl} target="_blank" rel="noopener noreferrer">시세 보기 <ArrowUpRight size={13} /></a><button onClick={() => onSelect(index)}><MessageCircle size={13} /> 게시판 열기</button></div>
    </article>; })}</div>
    {selected && <div ref={boardRef} className="index-board"><div className="index-board-heading"><div><span className="market-card-kicker">{selected.market}</span><h3>{selected.name} 게시판 <span>{posts.length}</span></h3><p>{selected.name}에 관한 글과 의견을 이 게시판에서 나눠보세요.</p></div><button className="outline-write" onClick={onWrite}><PenLine size={14} /> 글쓰기</button></div>
      {posts.length ? <div className="feed-list">{posts.map((post) => <PostCard key={post.id} post={post} stock={stockForIndex(selected)} onLike={() => onLike(post)} onComments={() => onComments(post)} onStock={() => onSelect(selected)} />)}</div> : <div className="feed-state"><MessageCircle size={24} /><strong>아직 {selected.name} 이야기가 없어요.</strong><span>이 지수의 첫 글을 작성해 보세요.</span><button onClick={onWrite}>글쓰기 <ArrowUpRight size={14} /></button></div>}
    </div>}
  </section>;
}
