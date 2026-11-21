import { useCallback, useEffect, useState } from 'react';
import type { StockDirectory, StockDirectoryItem } from '@/lib/stocks';

function isItem(value: unknown): value is StockDirectoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.symbol === 'string' && !!item.symbol && typeof item.name === 'string' && !!item.name &&
    typeof item.market === 'string' && !!item.market && typeof item.type === 'string' &&
    (item.englishName === undefined || typeof item.englishName === 'string');
}

function parseDirectory(value: unknown): StockDirectory {
  if (!value || typeof value !== 'object') throw new Error('종목 목록 응답이 올바르지 않아요.');
  const data = value as Record<string, unknown>;
  if ((data.source !== 'kis' && data.source !== 'toss') || typeof data.asOf !== 'string' ||
      !Number.isFinite(Date.parse(data.asOf)) || !Array.isArray(data.items) || !data.items.length || !data.items.every(isItem)) {
    throw new Error('종목 목록 응답이 올바르지 않아요.');
  }
  return data as StockDirectory;
}

export function useStockDirectory() {
  const [data, setData] = useState<StockDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch('/api/stocks', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('종목 목록을 불러오지 못했어요.');
        return response.json();
      })
      .then((value: unknown) => setData(parseDirectory(value)))
      .catch(() => { if (!controller.signal.aborted) { setData(null); setError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  return { data, loading, error, retry };
}
