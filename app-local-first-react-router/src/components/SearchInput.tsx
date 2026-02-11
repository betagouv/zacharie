import { useState, useEffect, useRef } from 'react';
import type { SearchResponse } from '@api/src/types/responses';
import { CarcasseType } from '@prisma/client';
import API from '@app/services/api';

interface SearchInputProps {
  className?: string;
  id?: string;
  type?: string;
}

// Debounce function will be created inside the component
export default function SearchInput({ className, id, type }: SearchInputProps) {
  const [value, setValue] = useState('');
  const [cachedValue, setCachedValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<SearchResponse['data']>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout>>();

  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDropdownOpen = !!error || isLoading || successData.length > 0;

  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setError('');
        setSuccessData([]);
        setIsLoading(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    clearTimeout(searchDebounce.current);

    searchDebounce.current = setTimeout(() => {
      if (value === cachedValue) return;
      setError('');
      setSuccessData([]);
      setValue(cachedValue);
      setIsLoading(true);
      API.get({
        path: 'search',
        query: { q: cachedValue },
      }).then((data: SearchResponse) => {
        setIsLoading(false);
        if (data.data?.length) {
          setSuccessData(data.data);
        }
        if (data.error) {
          setError(data.error);
          setSuccessData([]);
        }
      });
    }, 500);
  }, [cachedValue, value]);

  return (
    <div ref={containerRef} className="relative flex w-full flex-col">
      <input
        ref={searchRef}
        className={className}
        id={id}
        placeholder="Rechercher (carcasse ou fiche en cours)"
        type={type || 'search'}
        value={cachedValue}
        onChange={(event) => setCachedValue(event.target.value)}
      />
      {isDropdownOpen && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 flex w-full flex-col rounded border border-gray-200 bg-white shadow-lg">
          {!!error && (
            <p className="px-3 py-2 text-sm text-orange-700">{error}</p>
          )}
          {isLoading && (
            <p className="px-3 py-2 text-sm text-gray-500">Recherche en cours...</p>
          )}
          {successData.map((data) => (
            <a
              key={`${data.fei_numero || data.carcasse_numero_bracelet}`}
              href={data.redirectUrl}
              className="flex flex-col gap-0.5 border-t border-gray-100 px-3 py-2 first:border-t-0 hover:bg-gray-50"
            >
              {data.carcasse_numero_bracelet && (
                <span className="text-sm font-bold">
                  {data.carcasse_type === CarcasseType.PETIT_GIBIER ? 'Lot' : 'Carcasse'}{' '}
                  {data.carcasse_numero_bracelet}: {data.carcasse_espece}
                </span>
              )}
              {data.fei_numero && (
                <span className="text-sm">Fiche {data.fei_numero}</span>
              )}
              {data.fei_svi_assigned_at && (
                <span className="text-xs italic text-gray-500">
                  Transmise le {data.fei_svi_assigned_at}
                </span>
              )}
              {data.fei_date_mise_a_mort && (
                <span className="text-xs italic text-gray-500">
                  Chasse du {data.fei_date_mise_a_mort}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
