import { useState, useCallback } from "react";

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination<T>(
  fetcher: (page: number, pageSize: number) => Promise<PagedResult<T>>,
  options: UsePaginationOptions = {}
) {
  const pageSize = options.pageSize ?? 25;
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult<T>>({
    data: [], total: 0, page: 1, page_size: pageSize, total_pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher(pg, pageSize);
      setResult(res);
      setPage(pg);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [fetcher, pageSize]);

  const goTo = (pg: number) => load(pg);
  const refresh = () => load(page);

  return { ...result, page, loading, error, goTo, refresh };
}