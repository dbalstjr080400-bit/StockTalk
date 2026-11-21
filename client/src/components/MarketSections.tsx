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
  return <section className="market-content" aria-label="주요지수 목록">
    <div className="market-source-note"><BarChart3 size={17} /><span>지수 값과 변동률은 지연될 수 있습니다. 각 카드의 공식 시세 페이지에서 최신 값을 확인하세요.</span></div>
    <div className="index-grid">{MARKET_INDICES.map((index) => <article className={`index-card ${selected?.ticker === index.ticker ? 'selected' : ''}`} key={index.ticker}>
      <button className="index-card-main" onClick={() => onSelect(index)}><span className="market-card-kicker">{index.market}</span><strong>{index.name}</strong><span>{index.englishName}</span><p>{index.description}</p></button>
      <div className="index-card-actions"><a href={index.sourceUrl} target="_blank" rel="noopener noreferrer">시세 보기 <ArrowUpRight size={13} /></a><button onClick={() => onSelect(index)}><MessageCircle size={13} /> 이야기</button></div>
    </article>)}</div>
    {selected && <div className="index-board"><div className="index-board-heading"><div><span className="market-card-kicker">{selected.market}</span><h3>{selected.name} 이야기 <span>{posts.length}</span></h3><p>이 지수에 관한 의견을 주식 게시판과 같은 방식으로 나눠보세요.</p></div><button className="outline-write" onClick={onWrite}><PenLine size={14} /> 이야기 쓰기</button></div>
      {posts.length ? <div className="feed-list">{posts.map((post) => <PostCard key={post.id} post={post} stock={stockForIndex(selected)} onLike={() => onLike(post)} onComments={() => onComments(post)} onStock={() => onSelect(selected)} />)}</div> : <div className="feed-state"><MessageCircle size={24} /><strong>아직 {selected.name} 이야기가 없어요.</strong><span>첫 번째 생각을 나눠보세요.</span><button onClick={onWrite}>이야기 쓰기 <ArrowUpRight size={14} /></button></div>}
    </div>}
  </section>;
}
