import { Input, InputProps } from '@codegouvfr/react-dsfr/Input';
import { useState, ChangeEvent, useEffect, useRef } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { searchVilles } from '@app/utils/search-ville';

interface InputVilleProps extends InputProps.RegularInput {
  onSelect?: (ville: string) => void;
}
export default function InputVille(props: InputVilleProps) {
  const { onSelect, ...inputProps } = props;
  const [villeSearched, setVilleSearched] = useState<string>(() => {
    const defaultValue = props.nativeInputProps?.defaultValue;
    return typeof defaultValue === 'string' ? defaultValue : '';
  });
  const [isOpen, setIsOpen] = useState(false);
  const [villesResults, setVillesResults] = useState<Array<string>>([]);
  const debouncedVilleSearched = useDebounce(villeSearched, 300);

  const containerRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setVillesResults([]);
      return;
    }
    setVillesResults(searchVilles(debouncedVilleSearched));
  }, [debouncedVilleSearched, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const dismissOnClickOutside = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnClickOutside);
    return () => document.removeEventListener('pointerdown', dismissOnClickOutside);
  }, [isOpen]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsOpen(true);
    setVilleSearched(e.target.value);
  };

  const isVisible = isOpen && villesResults.length > 0;

  return (
    <div ref={containerRef}>
      <Input
        {...inputProps}
        nativeInputProps={{
          ...props.nativeInputProps,
          ref: ref,
          type: 'text',
          defaultValue: undefined,
          value: villeSearched,
          onChange: handleChange,
          onKeyDown: (e) => {
            if (e.key === 'Escape') setIsOpen(false);
            props.nativeInputProps?.onKeyDown?.(e);
          },
        }}
      />
      {/* la liste reste montée même vide : sans elle le champ devient `:last-child` et le DSFR
          lui retire sa marge basse */}
      <div
        className={
          isVisible ? '-mt-6 flex max-h-60 w-full flex-col overflow-y-auto border border-gray-200' : 'hidden'
        }
      >
        {isVisible &&
          villesResults.map((ville) => {
            return (
              <button
                key={ville}
                onClick={() => {
                  setVilleSearched(ville);
                  if (onSelect) onSelect(ville);
                  setIsOpen(false);
                  // the parent form is submitted on blur
                  // trigger a focus event then a blur again to submit the form
                  // this is a hack to submit the form on blur again
                  ref.current?.focus();
                }}
                type="button"
                className="block border-b-2! border-b-gray-200 py-1 pl-4 text-left"
              >
                {ville}
              </button>
            );
          })}
      </div>
    </div>
  );
}
