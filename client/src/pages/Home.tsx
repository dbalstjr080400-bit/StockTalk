import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bookmark, Check, ChevronDown, Compass, FileText, Flame, Heart, Home as HomeIcon, Lightbulb, Menu, MessageCircle, Plus, Search, ShieldCheck, Sparkles, TrendingUp, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { startLogin } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { STOCKS, searchStocks, stockFor, stockFromDirectory, type Stock } from '@/lib/stocks';
import { useStockDirectory } from '@/hooks/useStockDirectory';
import { PostCard, StockIcon, WatchStar, type Post } from '@/components/CommunityParts';
import { ComposeDialog, ThreadDialog } from '@/components/CommunityDialogs';
import { StockExplorer } from '@/components/StockExplorer';
import StockDetail from '@/components/StockDetail';
import { IndexSection, NewsSection } from '@/components/MarketSections';
import { MARKET_INDICES, isMarketIndex } from '@shared/marketIndices';

type Section = 'feed' | 'hot' | 'watch' | 'stocks' | 'news' | 'indices' | 'profit' | 'free' | 'me';
type PopularPeriod = 'all' | 'month' | 'week' | 'day';
function saved<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function visitor(): string { const existing = localStorage.getItem('moa-visitor'); if (existing && /^[A-Za-z0-9-]{1,128}$/.test(existing)) return existing; const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem('moa-visitor', id); return id; }

function PopularStocksPage({ stocks, period, onPeriod, visitCount, onSelect, watch, onToggleWatch }: { stocks: Stock[]; period: PopularPeriod; onPeriod: (period: PopularPeriod) => void; visitCount: (ticker: string) => number; onSelect: (ticker: string) => void; watch: string[]; onToggleWatch: (ticker: string) => void }) {
  return <section className="popular-stocks-page"><div className="popular-page-toolbar"><div><span className="section-kicker"><span /> STOCK DISCOVERY</span><h3>지금 많이 찾는 종목</h3><p>종목 상세에 들어간 관심도 순으로 정렬했어요.</p></div><div className="popular-period-tabs" role="tablist" aria-label="인기종목 조회 기간">{([['all', '전체'], ['month', '1개월'], ['week', '1주'], ['day', '1일']] as const).map(([value, label]) => <button key={value} type="button" className={period === value ? 'active' : ''} onClick={() => onPeriod(value)}>{label}</button>)}</div></div><div className="popular-main-list">{stocks.map((stock, index) => <div className="popular-main-row" key={stock.ticker}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><button className="rank-stock" onClick={() => onSelect(stock.ticker)}><StockIcon stock={stock} size="small" /><span><strong>{stock.name}</strong><small>{stock.ticker}</small><small className="rank-stock-views">조회수 {visitCount(stock.ticker).toLocaleString('ko-KR')}회</small></span></button><WatchStar active={watch.includes(stock.ticker)} name={stock.name} onClick={() => onToggleWatch(stock.ticker)} /></div>)}</div></section>;
}

export default function Home() {
  const auth = useAuth();
  const [section, setSection] = useState<Section>('feed');
  const [ticker, setTicker] = useState('all');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [search, setSearch] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [watch, setWatch] = useState<string[]>(() => saved('moa-watch', ['005930', '000660', 'NVDA']));
  const [stockVisits, setStockVisits] = useState<Record<string, number[]>>(() => saved('moa-stock-visits-v2', {}));
  const [popularPeriod, setPopularPeriod] = useState<PopularPeriod>('all');
  const [hotPeriod, setHotPeriod] = useState<PopularPeriod>('all');
  const [nickname, setNickname] = useState(() => saved('moa-name', ''));
  const [visitorId] = useState(visitor);
  const [compose, setCompose] = useState(false);
  const [thread, setThread] = useState<Post | null>(null);
  const [selectedIndexTicker, setSelectedIndexTicker] = useState<string | null>(null);
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
  const directory = useStockDirectory();
  const apiStocks = useMemo(() => directory.data?.items.map(stockFromDirectory) ?? [], [directory.data]);
  const stockIndex = useMemo(() => new Map(apiStocks.map((stock) => [stock.ticker, stock])), [apiStocks]);
  const posts = trpc.discussion.list.useQuery({ visitorId }, { refetchOnWindowFocus: true, refetchInterval: section === 'feed' && sort === 'popular' ? 60 * 60 * 1000 : 30_000 });
  const popularStocks = useMemo(() => {
    const now = Date.now();
    const periodMs = popularPeriod === 'day' ? 24 * 60 * 60 * 1000 : popularPeriod === 'week' ? 7 * 24 * 60 * 60 * 1000 : popularPeriod === 'month' ? 30 * 24 * 60 * 60 * 1000 : Infinity;
    const visitsFor = (ticker: string) => (stockVisits[ticker] ?? []).filter((timestamp) => periodMs === Infinity || now - timestamp <= periodMs).length;
    const stats = new Map<string, { posts: number; views: number }>();
    for (const post of posts.data ?? []) {
      const current = stats.get(post.ticker) ?? { posts: 0, views: 0 };
      current.posts += 1;
      current.views += Number.isFinite(post.views) ? post.views : 0;
      stats.set(post.ticker, current);
    }
    const candidates = [...STOCKS, ...apiStocks.filter((stock) => stats.has(stock.ticker) && !STOCKS.some((example) => example.ticker === stock.ticker))];
    return candidates
      .map((stock, index) => ({ stock: stockIndex.get(stock.ticker) ?? stock, index, stats: stats.get(stock.ticker) ?? { posts: 0, views: 0 }, visits: visitsFor(stock.ticker) }))
      .sort((a, b) => b.visits - a.visits || b.stats.posts - a.stats.posts || b.stats.views - a.stats.views || a.index - b.index)
      .map(({ stock }) => stock);
  }, [apiStocks, posts.data, popularPeriod, stockIndex, stockVisits]);
  const orderedStocks = useMemo(() => {
    const pinned = popularStocks.filter((stock) => stockIndex.get(stock.ticker) === stock);
    const pinnedSet = new Set(pinned);
    return [...pinned, ...apiStocks.filter((stock) => !pinnedSet.has(stock))];
  }, [apiStocks, popularStocks, stockIndex]);
  const searchCatalog = directory.data ? orderedStocks : popularStocks;
  const create = trpc.discussion.create.useMutation({ onSuccess: (_result, draft) => { setCompose(false); if (isMarketIndex(draft.ticker)) { setSection('indices'); setSelectedIndexTicker(draft.ticker); setTicker('all'); } else { setSection(draft.category === '수익인증' ? 'profit' : draft.category === '자유게시판' ? 'free' : 'feed'); setTicker(draft.category === '수익인증' || draft.category === '자유게시판' ? 'all' : draft.ticker); } setSort('recent'); setSearch(''); void posts.refetch(); toast.success('이야기를 올렸어요.'); }, onError: () => toast.error('게시글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.') });
  const like = trpc.discussion.toggleLike.useMutation({ onSuccess: () => { void posts.refetch(); }, onError: () => toast.error('공감을 표시하지 못했어요. 다시 시도해 주세요.') });
  const view = trpc.discussion.incrementViews.useMutation({ onSuccess: () => { void posts.refetch(); } });
  function updateNickname(name: string) { setNickname(name); localStorage.setItem('moa-name', JSON.stringify(name)); }
  function toggleWatch(id: string) { setWatch((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; localStorage.setItem('moa-watch', JSON.stringify(next)); return next; }); }
  function selectSection(next: Section) { setSection(next); setTicker('all'); setSelectedIndexTicker(null); setSearch(''); setStockSearch(''); setMobileMenu(false); if (next === 'hot') setSort('popular'); if (next === 'feed') setSort('recent'); }
  function selectStock(id: string) { setStockVisits((current) => { const next = { ...current, [id]: [...(current[id] ?? []), Date.now()] }; localStorage.setItem('moa-stock-visits-v2', JSON.stringify(next)); return next; }); setTicker(id); setSection('feed'); setMobileMenu(false); setSearch(''); }
  function selectIndex(id: string) { setSelectedIndexTicker(id); setSection('indices'); setTicker('all'); setSearch(''); setMobileMenu(false); }
  function openThread(post: Post) { view.mutate({ postId: post.id }); setThread(post); }
  function login() { try { startLogin(); } catch { toast.error('로그인을 시작할 수 없어요. 로그인 설정을 확인해 주세요.'); } }
  async function logout() { try { await auth.logout(); toast.success('로그아웃했어요.'); } catch { toast.error('로그아웃하지 못했어요. 다시 시도해 주세요.'); } }
  function resolveStock(id: string) {
    return stockIndex.get(id) ?? stockFor(id) ?? stockFromDirectory({ symbol: id, name: posts.data?.find((post) => post.ticker === id)?.stockName ?? id, market: '', type: '' });
  }
  const filteredPosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (posts.data ?? []).filter((post) => (ticker === 'all' || post.ticker === ticker) && (section !== 'watch' || watch.includes(post.ticker)) && (section !== 'profit' || post.category === '수익인증') && (section !== 'free' || post.category === '자유게시판') && (!term || `${post.title} ${post.content} ${post.stockName} ${post.ticker} ${post.author}`.toLowerCase().includes(term)));
    const periodMs = hotPeriod === 'day' ? 24 * 60 * 60 * 1000 : hotPeriod === 'week' ? 7 * 24 * 60 * 60 * 1000 : hotPeriod === 'month' ? 30 * 24 * 60 * 60 * 1000 : Infinity;
    const scoped = section === 'hot' && periodMs !== Infinity ? filtered.filter((post) => Date.now() - new Date(post.createdAt).getTime() <= periodMs) : filtered;
    return [...scoped].sort((a, b) => section === 'hot' || sort === 'popular' ? b.views - a.views || b.likes - a.likes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [posts.data, ticker, section, watch, search, sort, hotPeriod]);
  const selectedStock = ticker === 'all' ? undefined : resolveStock(ticker);
  const shownStocks = section === 'watch' ? watch.map(resolveStock) : popularStocks;
  const feedTabs = selectedStock && !shownStocks.some((stock) => stock.ticker === ticker) ? [selectedStock, ...shownStocks] : shownStocks;
  const matchedStocks = useMemo(() => search.trim() ? searchStocks(searchCatalog, search) : [], [searchCatalog, search]);
  const currentThread = thread ? (posts.data?.find((post) => post.id === thread.id) ?? thread) : null;
  const currentUserName = auth.user?.name?.trim() || nickname.trim();
  const myPosts = useMemo(() => currentUserName ? (posts.data ?? []).filter((post) => post.author === currentUserName) : [], [currentUserName, posts.data]);
  const likedPosts = useMemo(() => (posts.data ?? []).filter((post) => post.liked), [posts.data]);
  const indexStocks = useMemo(() => MARKET_INDICES.map((index) => stockFromDirectory({ symbol: index.ticker, name: index.name, englishName: index.englishName, market: index.market, type: 'INDEX' })), []);
  const indexByTicker = useMemo(() => new Map(MARKET_INDICES.map((index) => [index.ticker, index])), []);
  const selectedIndex = selectedIndexTicker ? indexByTicker.get(selectedIndexTicker) : undefined;
  const selectedIndexPosts = selectedIndex ? (posts.data ?? []).filter((post) => post.ticker === selectedIndex.ticker).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
  function visitCount(ticker: string) {
    const now = Date.now();
    const periodMs = popularPeriod === 'day' ? 24 * 60 * 60 * 1000 : popularPeriod === 'week' ? 7 * 24 * 60 * 60 * 1000 : popularPeriod === 'month' ? 30 * 24 * 60 * 60 * 1000 : Infinity;
    return (stockVisits[ticker] ?? []).filter((timestamp) => periodMs === Infinity || now - timestamp <= periodMs).length;
  }
  const composeStock = selectedIndex ? indexStocks.find((stock) => stock.ticker === selectedIndex.ticker) : selectedStock;
  const sidebarLinks: { id: Section; text: string; icon: typeof HomeIcon }[] = [
    { id: 'feed', text: '전체 피드', icon: HomeIcon }, { id: 'hot', text: '인기 토론', icon: Flame }, { id: 'watch', text: '관심 종목', icon: Bookmark }, { id: 'stocks', text: '종목 둘러보기', icon: Compass },
  ];
  const mainLinks: { id: Section; text: string }[] = [
    { id: 'stocks', text: '인기종목' }, { id: 'feed', text: '종목토론' }, { id: 'news', text: '주요뉴스' }, { id: 'indices', text: '주요지수' }, { id: 'watch', text: '관심종목' }, { id: 'free', text: '자유게시판' },
  ];
  const heading = section === 'stocks' ? '종목 둘러보기' : section === 'watch' ? '내 관심 종목 이야기' : section === 'hot' ? '지금 주목하는 이야기' : section === 'news' ? '주요뉴스' : section === 'indices' ? '주요지수' : section === 'profit' ? '수익인증' : section === 'free' ? '자유게시판' : selectedStock ? `${selectedStock.name} 이야기` : '살까, 팔까?';
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <button className="brand" onClick={() => selectSection('feed')} aria-label="모아 홈"><img src="/logo.svg" alt="" /><span className="brand-name">모아<span className="brand-dot">.</span></span><span className="brand-caption">투자 이야기가 모이는 곳</span></button>
      <div className="header-search"><Search size={18} /><input ref={searchRef} value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value) { setTicker('all'); setSection('feed'); } }} placeholder="종목이나 이야기를 검색해 보세요" aria-label="종목이나 이야기 검색" />{search && <button onClick={() => setSearch('')} aria-label="검색어 지우기"><X size={15} /></button>}<span className="search-key">⌘ K</span></div>
      <div className="header-actions">{auth.loading ? <span className="auth-status">확인 중</span> : auth.isAuthenticated && auth.user ? <><span className="auth-name">{auth.user.name || auth.user.email || '이름 미설정'}</span><button className="auth-button" onClick={() => void logout()}>로그아웃</button></> : <><button className="auth-button" onClick={login}>회원가입</button><button className="auth-button login-button" onClick={login}>로그인</button></>}</div>
    </div></header>
    <div className="market-bar"><div className="market-inner"><span className="market-label"><span className="market-dot" /> MARKET SNAPSHOT · 예시</span><div className="market-items"><span>KOSPI <b>2,745.32</b> <em>+0.84%</em></span><span>KOSDAQ <b>812.45</b> <em>+0.56%</em></span><span>NASDAQ <b>18,352.76</b> <em>+1.12%</em></span><span>USD/KRW <b>1,378.50</b> <em className="down">−0.23%</em></span></div><span className="sample-market">예시 데이터 · 실시간 아님</span></div></div>
    <div className="page-layout">
      <aside className={`left-sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <nav className="side-nav" aria-label="커뮤니티 메뉴">{sidebarLinks.map(({ id, text, icon: Icon }) => <button key={id} className={section === id ? 'active' : ''} onClick={() => selectSection(id)}><Icon size={19} strokeWidth={section === id ? 2.2 : 1.7} /><span>{text}</span>{id === 'hot' && <span className="nav-hot">HOT</span>}</button>)}<button className={section === 'me' ? 'active' : ''} onClick={() => selectSection('me')}><UserRound size={19} strokeWidth={section === 'me' ? 2.2 : 1.7} /><span>내정보</span></button></nav>
        <div className="side-divider" />
        <div className="sidebar-section-heading"><span>관심 종목</span><button onClick={() => selectSection('stocks')} aria-label="관심 종목 관리"><Plus size={17} /></button></div>
        <div className="sidebar-stocks">{watch.length ? watch.map(resolveStock).map((stock) => <button className={ticker === stock.ticker ? 'selected' : ''} key={stock.ticker} onClick={() => selectStock(stock.ticker)}><StockIcon stock={stock} size="small" /><span>{stock.name}</span><ArrowUpRight size={14} /></button>) : <p className="sidebar-empty">관심 종목을 추가해 보세요.</p>}</div>
        <button className="side-all-stocks" onClick={() => selectSection('stocks')}>모든 종목 보기 <ArrowRight size={14} /></button>
        <div className="sidebar-bottom"><div className="mini-bubble"><MessageCircle size={17} fill="currentColor" /></div><strong>생각이 모이면<br />시야가 넓어져요.</strong><span>오늘의 이야기를 나눠보세요.</span><button onClick={() => setCompose(true)}>이야기 쓰기 <ArrowRight size={14} /></button></div>
      </aside>
      {mobileMenu && <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={() => setMobileMenu(false)} />}
      <main className="main-column">
        <section className="hero"><div className="hero-copy"><div className="hero-label"><Sparkles size={14} /> INVEST TOGETHER</div><h1>좋은 투자는,<br /><span>좋은 대화에서.</span></h1><p>혼자서는 놓쳤던 관점, 모아에서 함께 발견해요.</p><button onClick={() => setCompose(true)}>나의 생각 나누기 <ArrowRight size={15} /></button></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-chat back"><span /><span /><span /></div><div className="hero-chat front"><span /><span /><span /></div><div className="hero-star">✦</div><div className="hero-small-dot" /></div><span className="hero-number">MOA COMMUNITY</span></section>
        <nav className="main-category-nav" aria-label="주요 메뉴">{mainLinks.map((link) => <button key={link.id} className={section === link.id ? 'active' : ''} aria-current={section === link.id ? 'page' : undefined} onClick={() => selectSection(link.id)}>{link.text}</button>)}</nav>
        <div className="content-heading"><div><div className="section-kicker"><span /> COMMUNITY FEED</div><h2>{heading} <span className="heading-spark">✳</span></h2><p>{section === 'stocks' ? '관심 있는 종목을 담고 다양한 이야기를 만나보세요.' : section === 'watch' ? '관심 종목에 올라온 이야기를 모았어요.' : section === 'indices' ? '국내외 증시와 가상자산 투자에 필요한 지표를 모았어요.' : section === 'news' ? '투자에 참고할 만한 국내외 주요 뉴스 출처를 모았어요.' : '다양한 시선으로 오늘의 시장을 이야기해요.'}</p></div>{section !== 'news' && section !== 'indices' && <button className="outline-write" onClick={() => setCompose(true)}><Plus size={16} /> 글쓰기</button>}</div>
        {section === 'me' ? <section className="my-page"><div className="my-profile-card"><div className="my-profile-icon"><UserRound size={24} /></div><div><span className="section-kicker"><span /> MY PAGE</span><h3>{currentUserName || '모아 회원님'}</h3><p>{auth.user?.email || (currentUserName ? '닉네임으로 활동 중이에요.' : '로그인하면 회원정보를 확인할 수 있어요.')}</p></div>{!auth.isAuthenticated && <button className="auth-button login-button" onClick={login}>로그인</button>}</div><div className="my-stats"><div><strong>{watch.length}</strong><span>관심 종목</span></div><div><strong>{myPosts.length}</strong><span>내가 쓴 글</span></div><div><strong>{likedPosts.length}</strong><span>공감한 글</span></div></div><div className="my-activity-heading"><div><span className="section-kicker"><span /> MY ACTIVITY</span><h3>내가 쓴 글</h3></div><FileText size={20} /></div>{myPosts.length ? <div className="feed-list">{myPosts.map((post) => <PostCard key={post.id} post={post} stock={resolveStock(post.ticker)} onLike={() => like.mutate({ postId: post.id, visitorId })} onComments={() => openThread(post)} onStock={() => selectStock(post.ticker)} />)}</div> : <div className="my-empty"><FileText size={26} /><strong>{currentUserName ? '아직 작성한 글이 없어요.' : '로그인하고 나의 활동을 모아보세요.'}</strong><span>관심 종목에 대한 생각을 남기면 이곳에서 다시 볼 수 있어요.</span>{currentUserName ? <button onClick={() => setCompose(true)}>첫 글 쓰기 <ArrowRight size={14} /></button> : <button onClick={login}>로그인하기 <ArrowRight size={14} /></button>}</div>}</section> : section === 'stocks' ? <><PopularStocksPage stocks={popularStocks} period={popularPeriod} onPeriod={setPopularPeriod} visitCount={visitCount} onSelect={selectStock} watch={watch} onToggleWatch={toggleWatch} /><StockExplorer stocks={orderedStocks} directory={directory.data} loading={directory.loading} error={directory.error} retry={directory.retry} query={stockSearch} onQuery={setStockSearch} watch={watch} onToggleWatch={toggleWatch} onSelect={selectStock} /></> : selectedStock && section === 'feed' ? <StockDetail stock={selectedStock} posts={filteredPosts} onBack={() => setTicker('all')} onLike={(post) => like.mutate({ postId: post.id, visitorId })} onComments={openThread} onWrite={() => setCompose(true)} isWatched={watch.includes(selectedStock.ticker)} onToggleWatch={() => toggleWatch(selectedStock.ticker)} /> : section === 'news' ? <NewsSection /> : section === 'indices' ? <IndexSection selected={selectedIndex} posts={selectedIndexPosts} indexStocks={indexStocks} onSelect={(index) => selectIndex(index.ticker)} onWrite={() => setCompose(true)} onLike={(post) => like.mutate({ postId: post.id, visitorId })} onComments={openThread} /> : <>
          {section === 'hot' && <div className="discussion-period-tabs" role="tablist" aria-label="인기 토론 조회 기간">{([['all', '전체'], ['month', '1개월'], ['week', '1주'], ['day', '1일']] as const).map(([value, label]) => <button key={value} type="button" className={hotPeriod === value ? 'active' : ''} onClick={() => setHotPeriod(value)}>{label}</button>)}</div>}
          <div className="feed-controls">{section === 'watch' && watch.length > 0 && <div className="stock-tabs"><button className={ticker === 'all' ? 'active' : ''} onClick={() => setTicker('all')}>전체</button>{feedTabs.filter((stock) => watch.includes(stock.ticker)).map((stock) => <button key={stock.ticker} className={ticker === stock.ticker ? 'active' : ''} onClick={() => setTicker(stock.ticker)}>{stock.name}</button>)}</div>}{selectedStock && <WatchStar active={watch.includes(selectedStock.ticker)} name={selectedStock.name} onClick={() => toggleWatch(selectedStock.ticker)} />}{section !== 'hot' && <><button className="sort-button" onClick={() => setSort(sort === 'recent' ? 'popular' : 'recent')}>{sort === 'recent' ? '최신순' : '인기순'} <ChevronDown size={15} /></button>{section === 'feed' && sort === 'popular' && <span className="popular-refresh-note">인기순은 1시간마다 갱신</span>}</>}</div>
          {search && <div className="search-summary"><strong>“{search}”</strong> 게시글 검색 결과 <span>{filteredPosts.length}개</span><button onClick={() => setSearch('')}>초기화 <X size={13} /></button></div>}
          {search && <div className="search-stock-results"><span>일치하는 종목</span>{matchedStocks.slice(0, 8).map((stock) => <button key={stock.ticker} onClick={() => selectStock(stock.ticker)}><StockIcon stock={stock} size="small" /><strong>{stock.name}</strong><small>{stock.ticker}</small><ArrowUpRight size={14} /></button>)}{directory.loading && <span>종목 목록 불러오는 중</span>}{directory.error && <><span>종목 목록을 불러오지 못했어요.</span><button onClick={directory.retry}>다시 시도</button></>}{!directory.error && !directory.loading && <button onClick={() => { setStockSearch(search); setSearch(''); setTicker('all'); setSection('stocks'); }}>종목 검색 결과 전체보기 <ArrowRight size={14} /></button>}</div>}
          <div className="feed-list">{posts.isLoading ? <div className="feed-state"><span className="loading-pulse" /> 이야기를 불러오는 중이에요.</div> : posts.isError ? <div className="feed-state">이야기를 불러오지 못했어요.<button onClick={() => void posts.refetch()}>다시 시도</button></div> : filteredPosts.length ? filteredPosts.map((post) => <PostCard key={post.id} post={post} stock={resolveStock(post.ticker)} onLike={() => like.mutate({ postId: post.id, visitorId })} onComments={() => openThread(post)} onStock={() => selectStock(post.ticker)} />) : <div className="feed-state"><MessageCircle size={26} /><strong>아직 이야기가 없어요</strong><span>첫 번째 이야기를 나누어 보는 건 어떨까요?</span><button onClick={() => setCompose(true)}>이야기 쓰기 <ArrowRight size={14} /></button></div>}</div>
          <div className="feed-end">서로 다른 생각이 모여 더 좋은 대화가 됩니다. <span>✳</span></div>
        </>}
      </main>
      <aside className="right-sidebar"><div className="right-card popular-card"><div className="right-card-title"><div><span className="section-kicker"><span /> STOCK DISCOVERY</span><h3>눈여겨볼 종목 <span>✳</span></h3></div><button onClick={() => selectSection('stocks')} aria-label="전체 종목 보기"><ArrowUpRight size={18} /></button></div><p className="right-card-subtitle">종목 상세 진입 조회수 순으로 보여드려요.</p><div className="popular-period-tabs" role="tablist" aria-label="인기종목 조회 기간">{([['all', '전체'], ['month', '1개월'], ['week', '1주'], ['day', '1일']] as const).map(([value, label]) => <button key={value} type="button" className={popularPeriod === value ? 'active' : ''} onClick={() => setPopularPeriod(value)}>{label}</button>)}</div><div className="ranking-list">{popularStocks.map((stock, i) => <div className="ranking-row" key={stock.ticker}><span className="rank-number">{String(i + 1).padStart(2, '0')}</span><button className="rank-stock" onClick={() => selectStock(stock.ticker)}><StockIcon stock={stock} size="small" /><span><strong>{stock.name}</strong><small>{stock.ticker}</small><small className="rank-stock-views">조회수 {visitCount(stock.ticker).toLocaleString('ko-KR')}회</small></span></button><WatchStar active={watch.includes(stock.ticker)} name={stock.name} onClick={() => toggleWatch(stock.ticker)} /></div>)}</div><button className="card-link" onClick={() => selectSection('stocks')}>종목 전체보기 <ArrowRight size={14} /></button></div>
        <div className="right-card insight-card"><div className="insight-icon"><Lightbulb size={18} /></div><span className="insight-label">MOA NOTE</span><h3>투자의 시작은<br />좋은 질문 하나부터.</h3><p>궁금한 점이 있다면 편하게 물어보세요. 서로 다른 생각이 새로운 힌트가 될 거예요.</p><button onClick={() => setCompose(true)}>질문하러 가기 <ArrowRight size={15} /></button><div className="insight-decoration">✳</div></div>
        <div className="community-note"><ShieldCheck size={17} /><div><strong>서로를 존중하는 투자 대화</strong><p>모아의 게시글은 투자 권유가 아니며, 투자 판단과 책임은 본인에게 있습니다.</p></div></div>
        <div className="right-card my-page-banner"><div className="my-banner-icon"><Menu size={17} /></div><span className="insight-label">모아 둘러보기</span><h3>나의 투자 활동을<br />한눈에 확인해요.</h3><p>회원정보와 내가 쓴 글, 공감한 글을 모아볼 수 있어요.</p><button onClick={() => selectSection('me')}>마이 페이지 <ArrowRight size={15} /></button></div>
        <div className="sidebar-footer">MOA COMMUNITY <span>© 2026 모아</span><br />함께 나누는, 더 넓은 시야</div>
      </aside>
    </div>
    <nav className="mobile-bottom" aria-label="모바일 메뉴">{sidebarLinks.filter(({ id }) => id !== 'watch').map(({ id, text, icon: Icon }) => <button className={section === id ? 'active' : ''} key={id} onClick={() => selectSection(id)}><Icon size={19} /><span>{text === '종목 둘러보기' ? '종목' : text.replace('전체 피드', '홈')}</span></button>)}<button onClick={() => setCompose(true)}><Plus size={19} /><span>글쓰기</span></button><button className={mobileMenu ? 'active' : ''} onClick={() => setMobileMenu(!mobileMenu)} aria-label="메뉴 열기"><Menu size={19} /><span>메뉴</span></button></nav>
    {compose && <ComposeDialog initialStock={composeStock} initialCategory={section === 'profit' ? '수익인증' : section === 'free' ? '자유게시판' : '자유토론'} stocks={selectedIndex ? [...indexStocks, ...searchCatalog] : searchCatalog} popular={selectedIndex ? [composeStock!, ...popularStocks] : popularStocks} loading={directory.loading} error={directory.error} retry={directory.retry} nickname={nickname} onNickname={updateNickname} onClose={() => setCompose(false)} pending={create.isPending} onSubmit={(draft) => create.mutate(draft)} />}
    {currentThread && <ThreadDialog post={currentThread} stock={resolveStock(currentThread.ticker)} nickname={nickname} onNickname={updateNickname} onClose={() => setThread(null)} onChanged={() => void posts.refetch()} />}
  </div>;
}
