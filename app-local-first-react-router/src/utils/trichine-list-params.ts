import { useSearchParams } from 'react-router';

export function useListParam(key: string, defaultValue: string): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;
  const set = (next: string) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (!next || next === defaultValue) params.delete(key);
        else params.set(key, next);
        return params;
      },
      { replace: true }
    );
  return [value, set];
}
