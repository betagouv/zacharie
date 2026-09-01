import { Input, InputProps } from '@codegouvfr/react-dsfr/Input';
import { useState, ChangeEvent, useEffect, useRef } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { searchVilles } from '@app/utils/search-ville';

interface InputVilleProps extends InputProps.RegularInput {
  trimPostCode?: boolean;
  postCode?: string;
  onSelect?: (ville: string) => void;
}
export default function InputVille(props: InputVilleProps) {
  const { trimPostCode, postCode, onSelect, ...inputProps } = props;
  const [villeSearched, setVilleSearched] = useState<string>(() => {
    const defaultValue = props.nativeInputProps?.defaultValue;
    return typeof defaultValue === 'string' ? defaultValue : '';
  });
  const debouncedVilleSearched = useDebounce(`${postCode ? postCode + ' ' : ''}${villeSearched}`, 300);
  const [villesResults, setVillesResults] = useState<string[]>([]);
  const canSearch = useRef(false);

  useEffect(() => {
    if (!debouncedVilleSearched || !canSearch.current) {
      return;
    }
    setVillesResults(searchVilles(debouncedVilleSearched));
  }, [debouncedVilleSearched]);

  useEffect(() => {
    if (!villeSearched && postCode && postCode.length >= 5) {
      setVillesResults(searchVilles(postCode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postCode]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    canSearch.current = true;
    setVilleSearched(e.target.value);
  };

  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <Input
        {...inputProps}
        nativeInputProps={{
          ...props.nativeInputProps,
          ref: ref,
          type: 'text',
          defaultValue: undefined,
          value: villeSearched,
          onChange: handleChange,
        }}
      />
      <div
        className={[
          'flex max-h-60 w-full flex-col overflow-y-auto border border-gray-200',
          villesResults.length > 0 ? '-mt-6' : 'hidden',
        ].join(' ')}
      >
        {villesResults.map((ville) => {
          return (
            <button
              key={ville}
              onClick={() => {
                if (trimPostCode) {
                  const codePostal = ville.split(' ')[0];
                  const trimedVille = ville.replace(codePostal, '').trim();
                  setVilleSearched(trimedVille);
                  if (onSelect) onSelect(trimedVille);
                } else {
                  setVilleSearched(ville);
                  if (onSelect) onSelect(ville);
                }
                setVillesResults([]);
                // the parent form is submitted on blur
                // trigger a focus event then a blur again to submit the form
                // this is a hack to submit the form on blur again
                ref.current?.focus();
                canSearch.current = false;
              }}
              type="button"
              className="block border-b-2! border-b-gray-200 py-1 pl-4 text-left"
            >
              {ville}
            </button>
          );
        })}
      </div>
    </>
  );
}
