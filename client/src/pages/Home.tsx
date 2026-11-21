import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bookmark, Check, ChevronDown, Compass, Flame, Heart, Home as HomeIcon, Lightbulb, Menu, MessageCircle, Plus, Search, ShieldCheck, Sparkles, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { STOCKS, stockFor } from '@/lib/stocks';
import { Avatar, PostCard, Sparkline, StockIcon, WatchStar, type Post } from '@/components/CommunityParts';
import { ComposeDialog, ThreadDialog } from '@/components/CommunityDialogs';

type Section = 'feed' | 'hot' | 'watch' | 'stocks';
function saved<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function visitor(): string { const existing = localStorage.getItem('moa-visitor'); if (existing) return existing; const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem('moa-visitor', id); return id; }

export default function Home() {
  const [section, setSection] = useState<Section>('feed');
  const [ticker, setTicker] = useState('all');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [search, setSearch] = useState('');
  const [watch, setWatch] = useState<string[]>(() => saved('moa-watch', ['005930', '000660', 'NVDA']));
  const [nickname, setNickname] = useState(() => saved('moa-name', ''));
  const [visitorId] = useState(visitor);
  const [compose, setCompose] = useState(false);
  const [thread, setThread] = useState<Post | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const posts = trpc.discussion.list.useQuery({ visitorId }, { refetchOnWindowFocus: true, refetchInterval: 30_000 });
  const create = trpc.discussion.create.useMutation({ onSuccess: () => { setCompose(false); setSection('feed'); setTicker('all'); setSort('recent'); setSearch(''); void posts.refetch(); toast.success('이야기를 올렸어요.'); }, onError: () => toast.error('게시글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.') });
  const like = trpc.discussion.toggleLike.useMutation({ onSuccess: () => { void posts.refetch(); }, onError: () => toast.error('공감을 표시하지 못했어요. 다시 시도해 주세요.') });
  function updateNickname(name: string) { setNickname(name); localStorage.setItem('moa-name', JSON.stringify(name)); }
  function toggleWatch(id: string) { setWatch((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; localStorage.setItem('moa-watch', JSON.stringify(next)); return next; }); }
  function selectSection(next: Section) { setSection(next); setTicker('all'); setSearch(''); setMobileMenu(false); if (next === 'hot') setSort('popular'); if (next === 'feed') setSort('recent'); }
  function selectStock(id: string) { setTicker(id); setSection('feed'); setMobileMenu(false); setSearch(''); }
  const filteredPosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (posts.data ?? []).filter((post) => (ticker === 'all' || post.ticker === ticker) && (section !== 'watch' || watch.includes(post.ticker)) && (!term || `${post.title} ${post.content} ${post.stockName} ${post.ticker} ${post.author}`.toLowerCase().includes(term)));
    return [...filtered].sort((a, b) => sort === 'popular' ? (b.likes + b.comments * 2) - (a.likes + a.comments * 2) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [posts.data, ticker, section, watch, search, sort]);
  const shownStocks = STOCKS.filter((stock) => section !== 'watch' || watch.includes(stock.ticker));
  const matchedStocks = search.trim() ? STOCKS.filter((stock) => `${stock.name} ${stock.ticker}`.toLowerCase().includes(search.trim().toLowerCase())) : [];
  const selectedStock = stockFor(ticker);
  const currentThread = thread ? (posts.data?.find((post) => post.id === thread.id) ?? thread) : null;
  const sidebarLinks: { id: Section; text: string; icon: typeof HomeIcon }[] = [
    { id: 'feed', text: '전체 피드', icon: HomeIcon }, { id: 'hot', text: '인기 토론', icon: Flame }, { id: 'watch', text: '관심 종목', icon: Bookmark }, { id: 'stocks', text: '종목 둘러보기', icon: Compass },
  ];
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <button className="mobile-menu-button icon-button" aria-label="메뉴 열기" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21} /></button>
      <button className="brand" onClick={() => selectSection('feed')} aria-label="모아 홈"><img src="/logo.svg" alt="" /><span className="brand-name">모아<span className="brand-dot">.</span></span><span className="brand-caption">투자 이야기가 모이는 곳</span></button>
      <div className="header-search"><Search size={18} /><input ref={searchRef} value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value) { setTicker('all'); setSection('feed'); } }} placeholder="종목이나 이야기를 검색해 보세요" aria-label="종목이나 이야기 검색" />{search && <button onClick={() => setSearch('')} aria-label="검색어 지우기"><X size={15} /></button>}<span className="search-key">⌘ K</span></div>
      <div className="header-actions"><span className="header-community"><span /> 커뮤니티</span><button className="header-write" onClick={() => setCompose(true)}><Plus size={17} /> 글쓰기</button></div>
    </div></header>
    <div className="market-bar"><div className="market-inner"><span className="market-label"><span className="market-dot" /> MARKET SNAPSHOT · 예시</span><div className="market-items"><span>KOSPI <b>2,745.32</b> <em>+0.84%</em></span><span>KOSDAQ <b>812.45</b> <em>+0.56%</em></span><span>NASDAQ <b>18,352.76</b> <em>+1.12%</em></span><span>USD/KRW <b>1,378.50</b> <em className="down">−0.23%</em></span></div><span className="sample-market">예시 데이터 · 실시간 아님</span></div></div>
    <div className="page-layout">
      <aside className={`left-sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="sidebar-intro">DISCOVER <span>모아 둘러보기</span></div>
        <nav className="side-nav" aria-label="커뮤니티 메뉴">{sidebarLinks.map(({ id, text, icon: Icon }) => <button key={id} className={section === id ? 'active' : ''} onClick={() => selectSection(id)}><Icon size={19} strokeWidth={section === id ? 2.2 : 1.7} /><span>{text}</span>{id === 'hot' && <span className="nav-hot">HOT</span>}</button>)}</nav>
        <div className="side-divider" />
        <div className="sidebar-section-heading"><span>관심 종목</span><button onClick={() => selectSection('stocks')} aria-label="관심 종목 관리"><Plus size={17} /></button></div>
        <div className="sidebar-stocks">{watch.length ? STOCKS.filter((stock) => watch.includes(stock.ticker)).map((stock) => <button className={ticker === stock.ticker ? 'selected' : ''} key={stock.ticker} onClick={() => selectStock(stock.ticker)}><StockIcon stock={stock} size="small" /><span>{stock.name}</span><ArrowUpRight size={14} /></button>) : <p className="sidebar-empty">관심 종목을 추가해 보세요.</p>}</div>
        <button className="side-all-stocks" onClick={() => selectSection('stocks')}>모든 종목 보기 <ArrowRight size={14} /></button>
        <div className="sidebar-bottom"><div className="mini-bubble"><MessageCircle size={17} fill="currentColor" /></div><strong>생각이 모이면<br />시야가 넓어져요.</strong><span>오늘의 이야기를 나눠보세요.</span><button onClick={() => setCompose(true)}>이야기 쓰기 <ArrowRight size={14} /></button></div>
      </aside>
      {mobileMenu && <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)} />}
      <main className="main-column">
        <section className="hero"><div className="hero-copy"><div className="hero-label"><Sparkles size={14} /> INVEST TOGETHER</div><h1>좋은 투자는,<br /><span>좋은 대화에서.</span></h1><p>혼자서는 놓쳤던 관점, 모아에서 함께 발견해요.</p><button onClick={() => setCompose(true)}>나의 생각 나누기 <ArrowRight size={15} /></button></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-chat back"><span /><span /><span /></div><div className="hero-chat front"><span /><span /><span /></div><div className="hero-star">✦</div><div className="hero-small-dot" /></div><span className="hero-number">MOA COMMUNITY</span></section>
        <div className="content-heading"><div><div className="section-kicker"><span /> COMMUNITY FEED</div><h2>{section === 'stocks' ? '종목 둘러보기' : section === 'watch' ? '내 관심 종목 이야기' : section === 'hot' ? '지금 주목하는 이야기' : selectedStock ? `${selectedStock.name} 이야기` : '지금 오가는 이야기'} <span className="heading-spark">✳</span></h2><p>{section === 'stocks' ? '관심 있는 종목을 담고 다양한 이야기를 만나보세요.' : section === 'watch' ? '관심 종목에 올라온 이야기를 모았어요.' : '다양한 시선으로 오늘의 시장을 이야기해요.'}</p></div><button className="outline-write" onClick={() => setCompose(true)}><Plus size={16} /> 글쓰기</button></div>
        {section === 'stocks' ? <div className="stock-explore"><div className="explore-top"><div><strong>모아의 종목</strong><span>종목을 선택하면 관련 대화를 볼 수 있어요</span></div><span className="example-pill">시세 예시</span></div><div className="explore-list">{STOCKS.map((stock) => <div className="explore-row" key={stock.ticker}><button className="explore-stock" onClick={() => selectStock(stock.ticker)}><StockIcon stock={stock} /><span><strong>{stock.name}</strong><small>{stock.ticker} · {stock.market}</small></span></button><Sparkline values={stock.line} negative={stock.change.startsWith('-')} /><div className="explore-price"><strong>{stock.price}</strong><span className={stock.change.startsWith('-') ? 'negative' : ''}>{stock.change}</span></div><WatchStar active={watch.includes(stock.ticker)} name={stock.name} onClick={() => toggleWatch(stock.ticker)} /></div>)}</div><p className="example-disclaimer">표시된 가격과 등락률은 화면 구성용 예시이며 실제 시세가 아닙니다.</p></div> : <>
          <div className="feed-controls"><div className="stock-tabs"><button className={ticker === 'all' ? 'active' : ''} onClick={() => setTicker('all')}>전체</button>{shownStocks.slice(0, 5).map((stock) => <button key={stock.ticker} className={ticker === stock.ticker ? 'active' : ''} onClick={() => setTicker(stock.ticker)}>{stock.name}</button>)}</div><button className="sort-button" onClick={() => setSort(sort === 'recent' ? 'popular' : 'recent')}>{sort === 'recent' ? '최신순' : '인기순'} <ChevronDown size={15} /></button></div>
          {search && <div className="search-summary"><strong>“{search}”</strong> 게시글 검색 결과 <span>{filteredPosts.length}개</span><button onClick={() => setSearch('')}>초기화 <X size={13} /></button></div>}
          {matchedStocks.length > 0 && <div className="search-stock-results"><span>일치하는 종목</span>{matchedStocks.map((stock) => <button key={stock.ticker} onClick={() => selectStock(stock.ticker)}><StockIcon stock={stock} size="small" /><strong>{stock.name}</strong><small>{stock.ticker}</small><ArrowUpRight size={14} /></button>)}</div>}
          <div className="feed-list">{posts.isLoading ? <div className="feed-state"><span className="loading-pulse" /> 이야기를 불러오는 중이에요.</div> : posts.isError ? <div className="feed-state">이야기를 불러오지 못했어요.<button onClick={() => void posts.refetch()}>다시 시도</button></div> : filteredPosts.length ? filteredPosts.map((post) => <PostCard key={post.id} post={post} onLike={() => like.mutate({ postId: post.id, visitorId })} onComments={() => setThread(post)} onStock={() => selectStock(post.ticker)} />) : <div className="feed-state"><MessageCircle size={26} /><strong>아직 이야기가 없어요</strong><span>첫 번째 이야기를 나누어 보는 건 어떨까요?</span><button onClick={() => setCompose(true)}>이야기 쓰기 <ArrowRight size={14} /></button></div>}</div>
          <div className="feed-end">서로 다른 생각이 모여 더 좋은 대화가 됩니다. <span>✳</span></div>
        </>}
      </main>
      <aside className="right-sidebar"><div className="right-card popular-card"><div className="right-card-title"><div><span className="section-kicker"><span /> STOCK DISCOVERY</span><h3>눈여겨볼 종목 <span>✳</span></h3></div><button onClick={() => selectSection('stocks')} aria-label="전체 종목 보기"><ArrowUpRight size={18} /></button></div><p className="right-card-subtitle">이야기를 나누고 싶은 종목을 찾아보세요.</p><div className="ranking-list">{STOCKS.slice(0, 5).map((stock, i) => <div className="ranking-row" key={stock.ticker}><span className="rank-number">{String(i + 1).padStart(2, '0')}</span><button className="rank-stock" onClick={() => selectStock(stock.ticker)}><StockIcon stock={stock} size="small" /><span><strong>{stock.name}</strong><small>{stock.ticker}</small></span></button><WatchStar active={watch.includes(stock.ticker)} name={stock.name} onClick={() => toggleWatch(stock.ticker)} /></div>)}</div><button className="card-link" onClick={() => selectSection('stocks')}>종목 전체보기 <ArrowRight size={14} /></button></div>
        <div className="right-card insight-card"><div className="insight-icon"><Lightbulb size={18} /></div><span className="insight-label">MOA NOTE</span><h3>투자의 시작은<br />좋은 질문 하나부터.</h3><p>궁금한 점이 있다면 편하게 물어보세요. 서로 다른 생각이 새로운 힌트가 될 거예요.</p><button onClick={() => setCompose(true)}>질문하러 가기 <ArrowRight size={15} /></button><div className="insight-decoration">✳</div></div>
        <div className="community-note"><ShieldCheck size={17} /><div><strong>서로를 존중하는 투자 대화</strong><p>모아의 게시글은 투자 권유가 아니며, 투자 판단과 책임은 본인에게 있습니다.</p></div></div>
        <div className="sidebar-footer">MOA COMMUNITY <span>© 2026 모아</span><br />함께 나누는, 더 넓은 시야</div>
      </aside>
    </div>
    <nav className="mobile-bottom" aria-label="모바일 메뉴">{sidebarLinks.map(({ id, text, icon: Icon }) => <button className={section === id ? 'active' : ''} key={id} onClick={() => selectSection(id)}><Icon size={19} /><span>{text === '종목 둘러보기' ? '종목' : text.replace('전체 피드', '홈')}</span></button>)}<button onClick={() => setCompose(true)}><Plus size={19} /><span>글쓰기</span></button></nav>
    {compose && <ComposeDialog initialTicker={ticker} nickname={nickname} onNickname={updateNickname} onClose={() => setCompose(false)} pending={create.isPending} onSubmit={(draft) => create.mutate(draft)} />}
    {currentThread && <ThreadDialog post={currentThread} nickname={nickname} onNickname={updateNickname} onClose={() => setThread(null)} onChanged={() => void posts.refetch()} />}
  </div>;
}
