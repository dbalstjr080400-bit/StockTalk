import { useEffect, useMemo, useState } from 'react';
import { searchStocks, type Stock } from '@/lib/stocks';
import { StockIcon } from './CommunityParts';

type Props = {
  stocks: Stock[];
  popular: Stock[];
  selected: Stock | undefined;
  onSelect: (stock: Stock | undefined) => void;
  loading: boolean;
  error: boolean;
  retry: () => void;
};

export function StockPicker({ stocks, popular, selected, onSelect, loading, error, retry }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => query.trim() ? searchStocks(stocks, query) : popular, [stocks, popular, query]);
  const visible = matches.slice(0, 10);
  useEffect(() => { setActive(0); }, [query]);
  function choose(stock: Stock) { onSelect(stock); setQuery(''); setOpen(false); }

  return <div className="stock-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label htmlFor="compose-stock">종목</label>
    <input id="compose-stock" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="compose-stock-options" aria-activedescendant={open && visible[active] ? `compose-stock-option-${active}` : undefined} value={open || !selected ? query : `${selected.name} · ${selected.ticker}`} placeholder="종목명 또는 티커 검색" onFocus={() => { setOpen(true); setQuery(''); }} onChange={(event) => { setQuery(event.target.value); onSelect(undefined); setOpen(true); }} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' && open && visible.length) { event.preventDefault(); setActive((value) => Math.min(value + 1, visible.length - 1)); }
      if (event.key === 'ArrowUp' && open && visible.length) { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
      if (event.key === 'Enter' && open && visible[active]) { event.preventDefault(); choose(visible[active]); }
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    }} />
    {open && <div className="stock-picker-menu" id="compose-stock-options" role="listbox" aria-label="검색된 종목">
      {!query.trim() && <div className="picker-caption">자주 찾는 종목 · 이름이나 티커로 검색해 보세요</div>}
      {visible.map((stock, index) => <button type="button" role="option" aria-selected={selected?.ticker === stock.ticker} id={`compose-stock-option-${index}`} className={index === active ? 'picker-option active' : 'picker-option'} key={`${stock.market}-${stock.ticker}-${index}`} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(stock)}><StockIcon stock={stock} size="small" /><span><strong>{stock.name}</strong><small>{stock.ticker} · {stock.market}{stock.englishName ? ` · ${stock.englishName}` : ''}</small></span></button>)}
      {!visible.length && <div className="picker-caption">{loading ? '종목 목록을 불러오는 중이에요.' : '일치하는 종목이 없어요.'}</div>}
      {matches.length > visible.length && <div className="picker-caption">상위 {visible.length}개 표시 · 검색어를 더 입력해 주세요.</div>}
    </div>}
    {error && <div className="picker-error" role="alert">종목 목록을 불러오지 못했어요. 예시 종목만 선택할 수 있어요. <button type="button" onClick={retry}>다시 시도</button></div>}
    {!selected && <span className="picker-hint">검색 결과에서 종목을 선택해 주세요.</span>}
  </div>;
}
