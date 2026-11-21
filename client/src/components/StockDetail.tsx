import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BarChart3, Heart, MessageCircle, PenLine, RefreshCw, Sparkles } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Post } from './CommunityParts';
import { WatchStar } from './CommunityParts';
import './stock-detail.css';

type Stock = { ticker: string; name: string; market: string };

type StockDetailProps = {
  stock: Stock;
  posts: Post[];
  onBack: () => void;
  onLike: (post: Post) => void;
  onComments: (post: Post) => void;
  onWrite: () => void;
  isWatched: boolean;
  onToggleWatch: () => void;
};

type ChartPoint = { date: string; close: number };
type ChartResponse = {
  symbol: string;
  name: string;
  market: string;
  source: string;
  sourceUrl: string;
  currency: string;
  exchangeTimezoneName: string;
  retrievedAt: string;
  priceBasis: string;
  points: ChartPoint[];
};
type AnalysisResponse = {
  analysis: string;
  generatedAt: string;
  source: string;
  asOf: string;
  currency: string;
};

type ChartState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: ChartResponse };

const priceFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 });
const countFormatter = new Intl.NumberFormat('ko-KR');

function formatPrice(value: number) {
  return priceFormatter.format(value);
}

// Preserve date-only values rather than shifting them through the viewer's timezone.
function formatDataDate(value: string) {
  const datePart = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return datePart ? `${datePart[1]}.${datePart[2]}.${datePart[3]}` : value;
}

function formatAxisDate(value: string) {
  const formatted = formatDataDate(value);
  return /^\d{4}\.\d{2}\.\d{2}$/.test(formatted) ? formatted.slice(2) : formatted;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '확인 불가';
  return `${new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date)} (한국 시간)`;
}

function formatPostDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { text: '확인 불가', dateTime: undefined, title: '날짜 확인 불가' };
  return {
    text: new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit' }).format(date),
    dateTime: date.toISOString(),
    title: formatTimestamp(date.toISOString()),
  };
}

function safeSourceUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function parseChart(value: unknown): ChartResponse {
  if (!value || typeof value !== 'object') throw new Error('가격 데이터를 확인할 수 없어요.');
  const data = value as Partial<ChartResponse>;
  if (!Array.isArray(data.points) || typeof data.source !== 'string' || !data.source.trim() ||
      typeof data.currency !== 'string' || !data.currency.trim() ||
      typeof data.retrievedAt !== 'string' || !data.retrievedAt.trim()) {
    throw new Error('가격 데이터의 형식이 올바르지 않아요.');
  }
  const points = data.points
    .filter((point): point is ChartPoint => Boolean(point) && typeof point.date === 'string' &&
      !Number.isNaN(Date.parse(point.date)) && typeof point.close === 'number' && Number.isFinite(point.close))
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (!points.length) throw new Error('이 종목의 가격 데이터가 없어요.');
  return {
    symbol: typeof data.symbol === 'string' ? data.symbol : '',
    name: typeof data.name === 'string' ? data.name : '',
    market: typeof data.market === 'string' ? data.market : '',
    source: data.source,
    sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : '',
    currency: data.currency,
    exchangeTimezoneName: typeof data.exchangeTimezoneName === 'string' ? data.exchangeTimezoneName : '',
    retrievedAt: data.retrievedAt,
    priceBasis: typeof data.priceBasis === 'string' ? data.priceBasis : '',
    points,
  };
}

function parseAnalysis(value: unknown): AnalysisResponse {
  if (!value || typeof value !== 'object') throw new Error('분석 응답을 확인할 수 없어요.');
  const data = value as Partial<AnalysisResponse>;
  if (typeof data.analysis !== 'string' || !data.analysis.trim() ||
      typeof data.generatedAt !== 'string' || !data.generatedAt.trim() ||
      typeof data.source !== 'string' || !data.source.trim() ||
      typeof data.asOf !== 'string' || !data.asOf.trim() ||
      typeof data.currency !== 'string' || !data.currency.trim()) {
    throw new Error('분석 결과가 비어 있거나 형식이 올바르지 않아요.');
  }
  return data as AnalysisResponse;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// The key guarantees an immediate reset, including pending requests, when ticker changes.
export default function StockDetail(props: StockDetailProps) {
  return <StockDetailContent key={props.stock.ticker} {...props} />;
}

function StockDetailContent({ stock, posts, onBack, onLike, onComments, onWrite, isWatched, onToggleWatch }: StockDetailProps) {
  const [chart, setChart] = useState<ChartState>({ status: 'loading' });
  const [chartAttempt, setChartAttempt] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setChart({ status: 'loading' });
    async function loadChart() {
      try {
        const response = await fetch(`/api/market/chart?symbol=${encodeURIComponent(stock.ticker)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('가격 데이터를 불러오지 못했어요.');
        const data = parseChart(await response.json());
        if (!controller.signal.aborted) setChart({ status: 'success', data });
      } catch (error) {
        if (!controller.signal.aborted) setChart({ status: 'error', message: errorMessage(error, '가격 데이터를 불러오지 못했어요.') });
      }
    }
    void loadChart();
    return () => controller.abort();
  }, [stock.ticker, chartAttempt]);

  useEffect(() => () => { analysisRequest.current?.abort(); }, []);

  async function requestAnalysis() {
    if (analysisRequest.current) return;
    const controller = new AbortController();
    analysisRequest.current = controller;
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const response = await fetch('/api/market/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: stock.ticker }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('AI 분석을 불러오지 못했어요.');
      const data = parseAnalysis(await response.json());
      if (!controller.signal.aborted) setAnalysis(data);
    } catch (error) {
      if (!controller.signal.aborted) setAnalysisError(errorMessage(error, 'AI 분석을 불러오지 못했어요.'));
    } finally {
      if (analysisRequest.current === controller) analysisRequest.current = null;
      if (!controller.signal.aborted) setAnalysisLoading(false);
    }
  }

  const chartData = chart.status === 'success' ? chart.data : null;
  const latestPoint = chartData?.points[chartData.points.length - 1];
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const point of chartData?.points ?? []) {
    minPrice = Math.min(minPrice, point.close);
    maxPrice = Math.max(maxPrice, point.close);
  }
  const padding = minPrice === maxPrice ? Math.max(Math.abs(minPrice) * 0.02, 1) : (maxPrice - minPrice) * 0.1;
  const domain: [number, number] = chartData ? [minPrice - padding, maxPrice + padding] : [0, 1];
  const sourceUrl = chartData ? safeSourceUrl(chartData.sourceUrl) : undefined;
  const demoCount = posts.filter((post) => post.isDemo).length;

  return <div className="stock-detail">
    <button type="button" className="sd-back" onClick={onBack}><ArrowLeft size={15} /> 종목 목록으로</button>

    <header className="sd-heading">
      <div className="sd-heading-icon" aria-hidden="true"><BarChart3 size={21} /></div>
      <div className="sd-heading-copy">
        <span className="sd-eyebrow">STOCK DETAIL</span>
        <h1>{stock.name}</h1>
        <div className="sd-stock-meta"><span>{stock.ticker}</span>{stock.market && <><span aria-hidden="true">·</span><span>{stock.market}</span></>}</div>
        <p className="sd-tagline">좋은 투자는, 좋은 대화에서.</p>
      </div>
      <WatchStar active={isWatched} name={stock.name} onClick={onToggleWatch} />
    </header>

    <section className="sd-panel sd-chart-panel" aria-labelledby="sd-chart-heading">
      <div className="sd-section-heading">
        <div><span className="sd-eyebrow">PRICE HISTORY</span><h2 id="sd-chart-heading">가격 흐름</h2></div>
        {chartData && latestPoint && <div className="sd-latest"><span>마지막 데이터 가격</span><strong>{formatPrice(latestPoint.close)} <small>{chartData.currency}</small></strong></div>}
      </div>
      {chart.status === 'loading' && <div className="sd-state" role="status"><span className="sd-spinner" aria-hidden="true" /><strong>가격 데이터를 불러오는 중이에요.</strong></div>}
      {chart.status === 'error' && <div className="sd-state" role="alert"><BarChart3 size={23} aria-hidden="true" /><strong>{chart.message}</strong><span>잠시 후 다시 시도해 주세요.</span><button type="button" onClick={() => setChartAttempt((attempt) => attempt + 1)}><RefreshCw size={13} /> 다시 시도</button></div>}
      {chartData && latestPoint && <>
        <div className="sd-chart" role="img" aria-label={`${stock.name} 가격 시계열 차트. ${formatDataDate(chartData.points[0].date)}부터 ${formatDataDate(latestPoint.date)}까지, 통화 ${chartData.currency}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData.points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <defs><linearGradient id="sd-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#db4b58" stopOpacity={0.2} /><stop offset="100%" stopColor="#db4b58" stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#f0eaeb" strokeDasharray="3 4" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} tick={{ fill: '#9a9295', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis domain={domain} tickFormatter={formatPrice} tick={{ fill: '#9a9295', fontSize: 10 }} tickLine={false} axisLine={false} width={78} tickCount={4} />
              <Tooltip labelFormatter={(label) => formatDataDate(String(label))} formatter={(value) => [`${formatPrice(Number(value))} ${chartData.currency}`, '가격']} contentStyle={{ border: '1px solid #f0dfe1', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="close" stroke="#d83d4b" strokeWidth={2.3} fill="url(#sd-chart-fill)" dot={chartData.points.length === 1} activeDot={{ r: 4 }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <dl className="sd-data-meta">
          <div><dt>출처</dt><dd>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{chartData.source} <ArrowUpRight size={11} /></a> : chartData.source}</dd></div>
          <div><dt>통화</dt><dd>{chartData.currency}</dd></div>
          <div><dt>최종 데이터 날짜</dt><dd>{formatDataDate(latestPoint.date)}</dd></div>
          <div><dt>조회 시간</dt><dd>{formatTimestamp(chartData.retrievedAt)}</dd></div>
          {chartData.priceBasis && <div><dt>가격 기준</dt><dd>{chartData.priceBasis}</dd></div>}
          {chartData.exchangeTimezoneName && <div><dt>거래소 시간대</dt><dd>{chartData.exchangeTimezoneName}</dd></div>}
        </dl>
      </>}
    </section>

    <section className="sd-panel sd-ai-panel" aria-labelledby="sd-ai-heading">
      <div className="sd-ai-head">
        <div className="sd-ai-title"><span className="sd-ai-icon" aria-hidden="true"><Sparkles size={17} /></span><div><span className="sd-eyebrow">AI INSIGHT</span><h2 id="sd-ai-heading">AI 분석</h2></div></div>
        <button type="button" className="sd-ai-button" disabled={analysisLoading} onClick={() => void requestAnalysis()}>
          {analysisLoading ? <><span className="sd-spinner sd-spinner-light" aria-hidden="true" /> 분석 중</> : <><Sparkles size={14} /> {analysisError ? '다시 시도' : analysis ? '다시 분석' : 'AI 분석 요청'}</>}
        </button>
      </div>
      <p className="sd-ai-disclaimer">해당 종목의 가격 시계열을 바탕으로 한 참고 자료이며, 투자 권유가 아닙니다. 결과가 부정확할 수 있으니 다른 자료와 함께 확인해 주세요.</p>
      {analysisLoading && <p className="sd-ai-progress" role="status">분석을 준비하고 있어요. 잠시만 기다려 주세요.</p>}
      {analysisError && <div className="sd-ai-error" role="alert"><strong>{analysisError}</strong><span>위의 다시 시도 버튼을 눌러 주세요.</span></div>}
      {analysis && <div className="sd-ai-result">
        <p>{analysis.analysis}</p>
        <dl className="sd-analysis-meta">
          <div><dt>출처</dt><dd>{analysis.source}</dd></div>
          <div><dt>데이터 기준</dt><dd>{formatDataDate(analysis.asOf)}</dd></div>
          <div><dt>통화</dt><dd>{analysis.currency}</dd></div>
          <div><dt>생성 시간</dt><dd>{formatTimestamp(analysis.generatedAt)}</dd></div>
        </dl>
      </div>}
    </section>

    <section className="sd-board" aria-labelledby="sd-board-heading">
      <div className="sd-board-heading">
        <div><span className="sd-eyebrow">COMMUNITY</span><h2 id="sd-board-heading">{stock.name} <span>{countFormatter.format(posts.length)}</span></h2><p>이 종목에 관해 나눈 이야기를 모았어요.{demoCount > 0 && ` 예시 글 ${countFormatter.format(demoCount)}개가 포함되어 있어요.`}</p></div>
        <button type="button" className="sd-write" onClick={onWrite}><PenLine size={14} /> 글쓰기</button>
      </div>
      {posts.length ? <>
        <p className="sd-scroll-hint">표를 좌우로 밀어 더 볼 수 있어요.</p>
        <div className="sd-table-wrap" tabIndex={0} role="region" aria-label={`${stock.name} 게시글 목록`}>
          <table className="sd-table">
            <colgroup><col className="sd-col-title" /><col className="sd-col-author" /><col className="sd-col-date" /><col className="sd-col-views" /><col className="sd-col-likes" /><col className="sd-col-comments" /></colgroup>
            <thead><tr><th scope="col">글 제목</th><th scope="col">글쓴이</th><th scope="col">날짜</th><th scope="col">조회</th><th scope="col">공감</th><th scope="col">댓글수</th></tr></thead>
            <tbody>{posts.map((post) => {
              const date = formatPostDate(post.createdAt);
              return <tr key={post.id} onClick={() => onComments(post)}>
                <td><div className="sd-title-cell">{post.category && <span className="sd-category">{post.category}</span>}<button type="button" className="sd-post-title" onClick={(event) => { event.stopPropagation(); onComments(post); }}>{post.title}</button>{post.isDemo && <span className="sd-demo">예시 글</span>}</div></td>
                <td className="sd-author" title={post.author}>{post.author}</td>
                <td><time dateTime={date.dateTime} title={date.title}>{date.text}</time></td>
                <td>{countFormatter.format(post.views)}</td>
                <td><button type="button" className={`sd-like ${post.liked ? 'is-liked' : ''}`} aria-pressed={post.liked} aria-label={`${post.title} ${post.liked ? '공감 취소' : '공감하기'}, ${countFormatter.format(post.likes)}개`} onClick={(event) => { event.stopPropagation(); onLike(post); }}><Heart size={13} fill={post.liked ? 'currentColor' : 'none'} aria-hidden="true" />{countFormatter.format(post.likes)}</button></td>
                <td><button type="button" className="sd-comments" aria-label={`${post.title} 댓글 ${countFormatter.format(post.comments)}개 보기`} onClick={(event) => { event.stopPropagation(); onComments(post); }}>{countFormatter.format(post.comments)}</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </> : <div className="sd-board-empty"><MessageCircle size={22} aria-hidden="true" /><strong>아직 이 종목의 글이 없어요.</strong><span>첫 번째 이야기를 나눠 보세요.</span><button type="button" onClick={onWrite}>글쓰기</button></div>}
    </section>
  </div>;
}
