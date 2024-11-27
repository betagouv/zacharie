import { useState, useEffect, useRef } from 'react';
import type { SearchResponse } from '@api/src/types/responses';
import { Alert } from '@codegouvfr/react-dsfr/Alert';

interface SearchInputProps {
  className?: string;
  id?: string;
  type?: string;
}

// Debounce function will be created inside the component
export default function SearchInput({ className, id, type }: SearchInputProps) {
  const [value, setValue] = useState('');
  const [cachedValue, setCachedValue] = useState(value);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<SearchResponse['data']>([]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout>>();
  const errorDebounce = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    clearTimeout(errorDebounce.current);
    searchDebounce.current = setTimeout(() => {
      if (value !== cachedValue) {
        setError('');
        setSuccessData([]);
        setValue(cachedValue);
        fetch(`${import.meta.env.VITE_API_URL}/search?q=${cachedValue}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
          .then((response) => response.json())
          .then((data: SearchResponse) => {
            if (data.data?.length) {
              setSuccessData(data.data);
            }
            if (data.error) {
              errorDebounce.current = setTimeout(() => {
                setError(data.error);
                setSuccessData([]);
              }, 3000);
            }
          });
      }
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedValue]);

  return (
    <div className="flex w-full flex-col">
      <input
        ref={searchRef}
        className={className}
        id={id}
        placeholder="Rechercher (carcasse ou fiche)"
        type={type || 'search'}
        value={cachedValue}
        onChange={(event) => setCachedValue(event.target.value)}
      />
      {!!error && (
        <div className="flex w-full flex-row justify-start">
          <Alert
            onClose={() => setError('')}
            description={error}
            closable
            id="search-error"
            severity="warning"
            title={error}
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
                <a href={data.redirectUrl}>
                  {[
                    data.carcasse_numero_bracelet && `Carcasse/Lot ${data.carcasse_numero_bracelet}`,
                    data.fei_numero && `Fiche trouvée ${data.fei_numero}`,
                  ]
                    .filter(Boolean)
                    .join('\n')}
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
