import { useState, useEffect, useRef } from 'react';
import type { SearchResponse } from '@api/src/types/responses';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { CarcasseType } from '@prisma/client';

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

  useEffect(() => {
    clearTimeout(searchDebounce.current);

    searchDebounce.current = setTimeout(() => {
      console.log('value', value, cachedValue);
      if (value === cachedValue) return;
      setError('');
      setSuccessData([]);
      setValue(cachedValue);
      setIsLoading(true);
      fetch(`${import.meta.env.VITE_API_URL}/search?q=${cachedValue}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((data: SearchResponse) => {
          console.log('data', data);
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
    <div className="flex w-full flex-col">
      <input
        ref={searchRef}
        className={className}
        id={id}
        placeholder="Rechercher (carcasse ou fiche en cours)"
        type={type || 'search'}
        value={cachedValue}
        onChange={(event) => setCachedValue(event.target.value)}
      />
      {!!error && (
        <div className="flex w-full flex-row justify-start">
          <Alert
            onClose={() => setError('')}
            description="La recherche s'effectue sur les fiches transmises au SVI dans les 20 derniers jours."
            closable
            id="search-error"
            severity="warning"
            title={error}
            className="w-full text-left"
          />
        </div>
      )}
      {isLoading && (
        <div className="flex w-full flex-row justify-start">
          <Alert
            onClose={() => setError('')}
            description="La recherche s'effectue sur les fiches transmises au SVI dans les 20 derniers jours."
            closable
            id="search-loading"
            severity="info"
            title="Recherche en cours..."
            className="w-full text-left"
          />
        </div>
      )}
      {successData.map((data) => {
        return (
          <div className="flex w-full flex-row justify-start">
            <Alert
              onClose={() => setError('')}
              description={error}
              closable
              id="search-success"
              severity="success"
              title={
                <a href={data.redirectUrl} className="flex flex-col">
                  {data.carcasse_numero_bracelet && (
                    <span className="text-base font-bold">
                      {data.carcasse_type === CarcasseType.PETIT_GIBIER ? 'Lot' : 'Carcasse'}{' '}
                      {data.carcasse_numero_bracelet}: {data.carcasse_espece}
                    </span>
                  )}
                  {data.fei_numero && <span className="text-base font-normal">Fiche {data.fei_numero}</span>}
                  {data.fei_svi_assigned_at && (
                    <span className="font-sm text-base font-normal italic opacity-50">
                      Fiche transmise le {data.fei_svi_assigned_at}
                    </span>
                  )}
                  {data.fei_date_mise_a_mort && (
                    <span className="font-sm text-base font-normal italic opacity-50">
                      Chasse du {data.fei_date_mise_a_mort}
                    </span>
                  )}
                </a>
              }
              className="w-full text-left"
            />
          </div>
        );
      })}
    </div>
  );
}
