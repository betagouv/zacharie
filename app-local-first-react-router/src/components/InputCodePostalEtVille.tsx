import { Input } from '@app/components/Input';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { searchVilles } from '@app/utils/search-ville';
import InputNotEditable from '@app/components/InputNotEditable';

const CODE_POSTAL_NAME = 'code_postal';
const VILLE_NAME = 'ville';

export interface CodePostalEtVille {
  codePostal: string;
  ville: string;
}

interface InputCodePostalEtVilleProps {
  idPrefix?: string;
  required?: boolean;
  notEditable?: boolean;
  autoCompleteAddress?: boolean;
  codePostalLabel?: ReactNode;
  villeLabel?: ReactNode;
  defaultCodePostal?: string;
  defaultVille?: string;
  onChange?: (values: CodePostalEtVille) => void;
  onSelect?: (values: CodePostalEtVille) => void;
  onBlur?: (values: CodePostalEtVille) => void;
}

export default function InputCodePostalEtVille({
  idPrefix,
  required,
  notEditable,
  autoCompleteAddress,
  codePostalLabel,
  villeLabel,
  defaultCodePostal = '',
  defaultVille = '',
  onChange,
  onSelect,
  onBlur,
}: InputCodePostalEtVilleProps) {
  const [codePostal, setCodePostal] = useState(defaultCodePostal);
  const [ville, setVille] = useState(defaultVille);
  const [isOpen, setIsOpen] = useState(false);
  const [openedFrom, setOpenedFrom] = useState<'codePostal' | 'ville'>('ville');
  const [villesResults, setVillesResults] = useState<Array<string>>([]);
  const debouncedSearch = useDebounce(`${codePostal ? codePostal + ' ' : ''}${ville}`, 300);

  const containerRef = useRef<HTMLDivElement>(null);
  const villeInputRef = useRef<HTMLInputElement>(null);

  const appliedDefaults = useRef({ codePostal: defaultCodePostal, ville: defaultVille });
  useEffect(() => {
    if (defaultCodePostal !== appliedDefaults.current.codePostal) {
      appliedDefaults.current.codePostal = defaultCodePostal;
      setCodePostal(defaultCodePostal);
    }
    if (defaultVille !== appliedDefaults.current.ville) {
      appliedDefaults.current.ville = defaultVille;
      setVille(defaultVille);
    }
  }, [defaultCodePostal, defaultVille]);

  useEffect(() => {
    if (!isOpen) {
      setVillesResults([]);
      return;
    }
    setVillesResults(searchVilles(debouncedSearch));
  }, [debouncedSearch, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const dismissOnClickOutside = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnClickOutside);
    return () => document.removeEventListener('pointerdown', dismissOnClickOutside);
  }, [isOpen]);

  const handleCodePostalChange = (newCodePostal: string) => {
    setCodePostal(newCodePostal);
    setOpenedFrom('codePostal');
    setIsOpen(newCodePostal.length >= 5 && !ville);
    onChange?.({ codePostal: newCodePostal, ville });
  };

  const handleVilleChange = (newVille: string) => {
    setVille(newVille);
    setOpenedFrom('ville');
    setIsOpen(true);
    onChange?.({ codePostal, ville: newVille });
  };

  const handleSelect = (result: string) => {
    const [newCodePostal, ...villeWords] = result.split(' ');
    const newVille = villeWords.join(' ');
    setCodePostal(newCodePostal);
    setVille(newVille);
    setIsOpen(false);
    onChange?.({ codePostal: newCodePostal, ville: newVille });
    onSelect?.({ codePostal: newCodePostal, ville: newVille });
    villeInputRef.current?.focus();
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!onBlur) return;
    if (containerRef.current?.contains(event.relatedTarget)) return;
    onBlur({ codePostal, ville });
  };

  const villesList = (openedIn: 'codePostal' | 'ville') => {
    const isVisible = isOpen && openedFrom === openedIn && villesResults.length > 0;
    return (
      <div
        className={
          isVisible ? '-mt-6 flex max-h-60 w-full flex-col overflow-y-auto border border-gray-200' : 'hidden'
        }
      >
        {isVisible &&
          villesResults.map((result) => {
            return (
              <button
                key={result}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(result)}
                type="button"
                className="block border-b-2! border-b-gray-200 py-1 pl-4 text-left"
              >
                {result}
              </button>
            );
          })}
      </div>
    );
  };

  const CodePostalComponent = notEditable ? InputNotEditable : Input;
  const VilleComponent = notEditable ? InputNotEditable : Input;
  const fieldId = (field: string) => (idPrefix ? `${idPrefix}-${field}` : field);

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      className="flex w-full flex-col gap-x-4 md:flex-row"
    >
      <div className="shrink-0 md:basis-2/5">
        <CodePostalComponent
          label={codePostalLabel ?? `Code postal${required ? ' *' : ''}`}
          hintText="5 chiffres"
          nativeInputProps={{
            id: fieldId(CODE_POSTAL_NAME),
            name: CODE_POSTAL_NAME,
            autoComplete: autoCompleteAddress ? 'postal-code' : 'off',
            required: required,
            value: codePostal,
            onChange: (e) => handleCodePostalChange(e.currentTarget.value),
            onKeyDown: (e) => {
              if (e.key === 'Escape') setIsOpen(false);
            },
          }}
        />
        {villesList('codePostal')}
      </div>
      <div className="basis-3/5">
        <VilleComponent
          label={villeLabel ?? `Ville ou commune${required ? ' *' : ''}`}
          hintText="Exemple : Montpellier"
          nativeInputProps={{
            ref: villeInputRef,
            id: fieldId(VILLE_NAME),
            name: VILLE_NAME,
            autoComplete: autoCompleteAddress ? 'address-level2' : 'off',
            required: required,
            value: ville,
            onChange: (e) => handleVilleChange(e.currentTarget.value),
            onKeyDown: (e) => {
              if (e.key === 'Escape') setIsOpen(false);
            },
          }}
        />
        {villesList('ville')}
      </div>
    </div>
  );
}
