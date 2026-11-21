import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  Globe2,
  Info,
  LoaderCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

type Market = "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "AMEX" | "KR_ETC" | "US_ETC";
type Region = "all" | "kr" | "us";
type Stock = {
  symbol: string;
  name: string;
  englishName?: string;
  market: Market;
  type: string;
};
type StockDirectory = {
  source: "toss" | "kis";
  asOf: string;
  items: Stock[];
};

const PAGE_SIZE = 30;
const KR_MARKETS: Market[] = ["KOSPI", "KOSDAQ", "KR_ETC"];
const US_MARKETS: Market[] = ["NASDAQ", "NYSE", "AMEX", "US_ETC"];
const MARKET_LABELS: Record<Market, string> = {
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
  NASDAQ: "나스닥",
  NYSE: "뉴욕증권거래소",
  AMEX: "아멕스",
  KR_ETC: "국내 기타",
  US_ETC: "미국 기타",
};
const SEARCH_ALIASES: Record<string, string[]> = {
  "삼성전자": ["005930"],
  "애플": ["aapl", "apple"],
  "테슬라": ["tsla", "tesla"],
};

function formatAsOf(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기준일 정보 없음";
  return `${new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} (한국 시간)`;
}

function isKoreanMarket(market: Market) {
  return KR_MARKETS.includes(market);
}

function StockMark({ stock }: { stock: Stock }) {
  const isKr = isKoreanMarket(stock.market);
  const label = isKr ? stock.name.slice(0, 1) : stock.symbol.slice(0, 2).toUpperCase();
  return <span className={`stock-mark ${isKr ? "stock-mark-kr" : "stock-mark-us"}`} aria-hidden="true">{label}</span>;
}

export default function Home() {
  const [directory, setDirectory] = useState<StockDirectory | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [region, setRegion] = useState<Region>("all");
  const [market, setMarket] = useState<Market | "all">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch("/api/stocks", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("종목 목록 요청 실패");
        const data: unknown = await response.json();
        if (
          !data || typeof data !== "object" ||
          !("source" in data) || (data.source !== "toss" && data.source !== "kis") ||
          !("asOf" in data) || typeof data.asOf !== "string" ||
          !("items" in data) || !Array.isArray(data.items)
        ) throw new Error("올바르지 않은 종목 목록");
        return data as StockDirectory;
      })
      .then(data => {
        setDirectory(data);
        setStatus("ready");
      })
      .catch(error => {
        if (error.name !== "AbortError") {
          setDirectory(null);
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [retryCount]);

  const counts = useMemo(() => {
    if (!directory) return null;
    let kr = 0;
    let us = 0;
    for (const stock of directory.items) {
      if (KR_MARKETS.includes(stock.market)) kr++;
      if (US_MARKETS.includes(stock.market)) us++;
    }
    return { all: directory.items.length, kr, us };
  }, [directory]);

  const filteredStocks = useMemo(() => {
    if (!directory) return [];
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    const terms = normalizedQuery ? [normalizedQuery, ...(SEARCH_ALIASES[normalizedQuery] ?? [])] : [];
    const matches = directory.items.filter(stock => {
      if (region === "kr" && !KR_MARKETS.includes(stock.market)) return false;
      if (region === "us" && !US_MARKETS.includes(stock.market)) return false;
      if (market !== "all" && stock.market !== market) return false;
      if (!terms.length) return true;
      const searchable = `${stock.name} ${stock.englishName ?? ""} ${stock.symbol}`.toLocaleLowerCase();
      return terms.some(term => searchable.includes(term));
    });
    if (!normalizedQuery) return matches;
    const matchPriority = (stock: Stock) => {
      const fields = [stock.symbol, stock.name, stock.englishName ?? ""].map(value => value.toLocaleLowerCase());
      if (terms.some(term => fields.some(value => value === term))) return 0;
      if (terms.some(term => fields.some(value => value.startsWith(term)))) return 1;
      return 2;
    };
    return matches.sort((a, b) => matchPriority(a) - matchPriority(b));
  }, [directory, deferredQuery, region, market]);

  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleStocks = filteredStocks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const availableMarkets = region === "kr" ? KR_MARKETS : region === "us" ? US_MARKETS : [...KR_MARKETS, ...US_MARKETS];

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };
  const updateRegion = (value: Region) => {
    setRegion(value);
    setMarket("all");
    setPage(1);
  };
  const resetFilters = () => {
    setQuery("");
    setRegion("all");
    setMarket("all");
    setPage(1);
  };
  const chooseExample = (value: string) => {
    setQuery(value);
    setRegion("all");
    setMarket("all");
    setPage(1);
    document.getElementById("stocks")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const goToPage = (value: number) => {
    setPage(value);
    document.getElementById("stock-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const countLabel = (value: number | undefined) => value === undefined ? "—" : value.toLocaleString("ko-KR");

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a href="#top" className="brand" aria-label="모아 맨 위로">
            <span className="brand-symbol" aria-hidden="true"><i /><i /><i /><i /></span>
            <span>모아</span><span className="brand-dot">.</span>
          </a>
          <nav className="header-nav" aria-label="주 메뉴">
            <a className="nav-active" href="#stocks">종목 둘러보기</a>
            <a href="#data-info">데이터 안내</a>
          </nav>
          <div className="header-note"><span className="header-note-dot" /> 나의 투자를 알아가는 시간</div>
        </div>
      </header>

      <main id="top">
        <section className="hero-wrap" aria-labelledby="hero-title">
          <div className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> EVERY STOCK, IN ONE PLACE</div>
              <h1 id="hero-title">궁금한 종목을<br /><span>하나씩, 모아.</span></h1>
              <p>국내부터 미국까지, 찾고 있던 종목을<br className="desktop-break" /> 한 곳에서 편하게 살펴보세요.</p>
              <a className="hero-link" href="#stocks">종목 둘러보기 <ArrowDown size={15} strokeWidth={2} /></a>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
              <div className="art-center"><span className="art-center-small">A LITTLE CLOSER TO</span><strong>my<br />investment.</strong><span className="art-center-bottom">모아와 함께, 천천히</span></div>
              <div className="art-pill pill-kr"><span className="pill-icon">KR</span><span>국내 주식<small>KOREA</small></span></div>
              <div className="art-pill pill-us"><span className="pill-icon pill-icon-us">US</span><span>미국 주식<small>UNITED STATES</small></span></div>
              <span className="art-star star-one">✳</span><span className="art-star star-two">✳</span>
            </div>
            <span className="hero-index">MOA DIRECTORY &nbsp; / &nbsp; 01</span>
          </div>
        </section>

        <section className="content-wrap" id="stocks" aria-labelledby="section-title">
          <div className="section-heading">
            <div>
              <div className="section-kicker"><span /> STOCK DIRECTORY</div>
              <h2 id="section-title">종목 둘러보기</h2>
              <p>관심 있는 종목을 검색하고, 시장별로 살펴보세요.</p>
            </div>
            <div className="section-heading-note"><Globe2 size={15} /> 국내 · 미국 종목 모아보기</div>
          </div>

          <div className="main-layout">
            <div className="directory-panel">
              {status === "ready" && directory && <div className="source-notice"><Info size={15} /><span>{directory.source === "toss" ? <><strong>토스증권 공식 목록</strong>을 보여드려요.</> : <><strong>한국투자증권 공개 종목 목록</strong> · 토스증권 거래 가능 여부는 다를 수 있어요.</>}</span></div>}
              <div className="search-area">
                <label className="search-box" htmlFor="stock-search">
                  <Search className="search-icon" size={21} strokeWidth={2} />
                  <input id="stock-search" value={query} onChange={event => updateQuery(event.target.value)} placeholder="종목명 또는 티커를 검색해 보세요" autoComplete="off" />
                  {query && <button className="clear-search" type="button" onClick={() => updateQuery("")} aria-label="검색어 지우기"><X size={16} /></button>}
                  <span className="search-key">검색</span>
                </label>
                <div className="quick-search"><span>이렇게 찾아보세요</span><div>{["삼성전자", "애플", "AAPL"].map(example => <button type="button" key={example} onClick={() => chooseExample(example)}>{example}<ArrowRight size={12} /></button>)}</div></div>
              </div>

              <div className="filters" aria-label="종목 필터">
                <div className="region-tabs" role="group" aria-label="국가 선택">
                  {([ ["all", "전체"], ["kr", "국내"], ["us", "미국"] ] as [Region, string][]).map(([value, label]) => <button type="button" key={value} className={region === value ? "selected" : ""} aria-pressed={region === value} onClick={() => updateRegion(value)}>{label}</button>)}
                </div>
                <label className="market-select"><SlidersHorizontal size={15} /><span className="sr-only">거래소 선택</span><select value={market} onChange={event => { setMarket(event.target.value as Market | "all"); setPage(1); }}><option value="all">전체 거래소</option>{availableMarkets.map(value => <option key={value} value={value}>{MARKET_LABELS[value]}</option>)}</select><ChevronRight className="select-chevron" size={14} /></label>
              </div>

              <div className="results" id="stock-results">
                <div className="results-heading">
                  <div><strong>종목 목록</strong>{status === "ready" && <span className="result-count">{filteredStocks.length.toLocaleString("ko-KR")}</span>}</div>
                  <span>{status === "ready" ? "이름 · 티커 · 거래소" : status === "loading" ? "종목 정보를 불러옵니다" : "종목 정보를 확인할 수 없어요"}</span>
                </div>
                {status === "loading" && <div className="state-box" role="status"><LoaderCircle className="spin" size={26} /><strong>종목을 모아오고 있어요</strong><p>잠시만 기다려 주세요.</p></div>}
                {status === "error" && <div className="state-box" role="alert"><span className="state-icon"><CircleAlert size={22} /></span><strong>종목을 불러오지 못했어요</strong><p>연결 상태를 확인하고 다시 시도해 주세요.</p><button type="button" className="outline-button" onClick={() => setRetryCount(value => value + 1)}><RotateCcw size={14} /> 다시 시도</button></div>}
                {status === "ready" && filteredStocks.length === 0 && <div className="state-box"><span className="state-icon"><Search size={21} /></span><strong>찾으시는 종목이 없어요</strong><p>검색어 또는 필터를 바꿔서 다시 찾아보세요.</p><button type="button" className="outline-button" onClick={resetFilters}><RotateCcw size={14} /> 검색 조건 초기화</button></div>}
                {status === "ready" && visibleStocks.length > 0 && <>
                  <div className="stock-list" role="list" aria-label="검색된 종목">
                    {visibleStocks.map((stock, index) => <div className="stock-row" role="listitem" key={`${stock.market}-${stock.symbol}-${index}`}>
                      <StockMark stock={stock} />
                      <div className="stock-name"><strong>{stock.name}</strong><span>{stock.englishName && stock.englishName !== stock.name ? `${stock.englishName} · ` : ""}{stock.symbol}</span></div>
                      <div className="stock-meta"><span className="market-badge">{MARKET_LABELS[stock.market] ?? stock.market}</span><span className="stock-type">{stock.type}</span></div>
                    </div>)}
                  </div>
                  <div className="pagination" aria-label="페이지 이동">
                    <span className="page-summary">{((currentPage - 1) * PAGE_SIZE + 1).toLocaleString("ko-KR")}–{Math.min(currentPage * PAGE_SIZE, filteredStocks.length).toLocaleString("ko-KR")} <span>/ {filteredStocks.length.toLocaleString("ko-KR")}개</span></span>
                    <div className="page-controls"><button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="이전 페이지"><ChevronLeft size={17} /></button><span><strong>{currentPage.toLocaleString("ko-KR")}</strong> / {totalPages.toLocaleString("ko-KR")}</span><button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="다음 페이지"><ChevronRight size={17} /></button></div>
                  </div>
                </>}
              </div>
            </div>

            <aside className="sidebar" aria-label="종목 데이터 요약">
              <div className="summary-card">
                <div className="card-topline"><span>THE DIRECTORY</span><span className="mini-mark">✳</span></div>
                <h3>모아에서 만나는<br />다양한 종목들</h3>
                <p>목록에 담긴 종목을 시장별로<br />살펴볼 수 있어요.</p>
                <div className="total-count"><span>전체 종목</span><strong>{countLabel(counts?.all)}<small>개</small></strong></div>
                <div className="count-divider" />
                <div className="region-count"><span><i className="count-dot kr-dot" /> 국내</span><strong>{countLabel(counts?.kr)}<small>개</small></strong></div>
                <div className="region-count"><span><i className="count-dot us-dot" /> 미국</span><strong>{countLabel(counts?.us)}<small>개</small></strong></div>
              </div>
              <div className="info-card" id="data-info">
                <span className="info-icon"><Database size={17} /></span>
                <h3>종목 데이터 안내</h3>
                {status === "ready" && directory ? <>
                  <div className="source-label"><span /> {directory.source === "toss" ? "토스증권 공식 목록" : "한국투자증권 공개 종목 마스터"}</div>
                  {directory.source === "kis" ? <p className="source-warning">한국투자증권 공개 종목 마스터를 기반으로 합니다. <strong>토스증권 실제 거래 가능 여부는 다를 수 있음</strong></p> : <p>토스증권에서 제공하는 공식 종목 목록을 보여드려요.</p>}
                  <div className="as-of"><span>데이터 기준</span><strong>{formatAsOf(directory.asOf)}</strong></div>
                </> : <p>{status === "loading" ? "데이터 출처와 기준일을 확인하고 있어요." : "목록을 불러오면 출처와 기준일을 확인할 수 있어요."}</p>}
              </div>
              <div className="quiet-note"><Info size={15} /><p>이곳에서는 종목 목록만 제공해요.<br />실시간 시세나 투자 추천 정보는 포함되어 있지 않습니다.</p></div>
            </aside>
          </div>
        </section>
      </main>
      <footer className="site-footer"><div><span className="footer-brand">모아<span>.</span></span><p>관심 있는 것들을 하나씩 모아, 나만의 시선으로.</p><span>MOA · STOCK DIRECTORY</span></div></footer>
    </div>
  );
}
