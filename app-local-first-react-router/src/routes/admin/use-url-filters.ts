import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

export type UrlFilterValue = string | Array<string> | null;

export function useUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const setFilters = useCallback(
    (updates: Record<string, UrlFilterValue>, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            const serialized = Array.isArray(value) ? value.join(',') : value;
            if (serialized) next.set(key, serialized);
            else next.delete(key);
          }
          if (!('page' in updates)) next.delete('page');
          return next;
        },
        { replace: options?.replace }
      );
    },
    [setSearchParams]
  );

  const replaceFilters = useCallback(
    (params: Record<string, string>, keep: Array<string> = []) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(params);
        for (const key of keep) {
          const value = prev.get(key);
          if (value && !next.has(key)) next.set(key, value);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  return { searchParams, setFilters, replaceFilters };
}

export function useUrlList(searchParams: URLSearchParams, key: string): Array<string> {
  const raw = searchParams.get(key) ?? '';
  return useMemo(() => raw.split(',').filter(Boolean), [raw]);
}

export function usePageOffset(searchParams: URLSearchParams, limit: number) {
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  return (page - 1) * limit;
}

export function toApiQuery(searchParams: URLSearchParams, limit: number, offset: number) {
  const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
  searchParams.forEach((value, key) => {
    if (key !== 'page' && value) query[key] = value;
  });
  return query;
}

export function useDebouncedUrlText(urlValue: string, commit: (value: string) => void, delay = 300) {
  const [text, setText] = useState(urlValue);
  const committedRef = useRef(urlValue);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => {
    if (urlValue === committedRef.current) return;
    committedRef.current = urlValue;
    setText(urlValue);
  }, [urlValue]);

  useEffect(() => {
    if (text === committedRef.current) return;
    const timeout = setTimeout(() => {
      committedRef.current = text;
      commitRef.current(text);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  return [text, setText] as const;
}
