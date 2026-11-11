import { Input } from '@app/components/Input';
import { useState, ChangeEvent, useEffect, useRef, useMemo, type ReactNode } from 'react';

type DestinataireOption = { label: string | null; value: string };

interface InputDestinataireProps {
  label: string;
  hintText?: ReactNode;
  inputId: string;
  options: Array<DestinataireOption>;
  value: string | null;
  onSelect: (value: string | null) => void;
  onCreate: (query: string) => void;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Même principe que InputVille : un champ texte DSFR et la liste des résultats en dessous.
// Quand la recherche ne donne rien, on propose de créer le destinataire.
export default function InputDestinataire({
  label,
  hintText,
  inputId,
  options,
  value,
  onSelect,
  onCreate,
}: InputDestinataireProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';
  const [search, setSearch] = useState<string>(selectedLabel);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // un destinataire choisi ailleurs (bouton, création) s'affiche dans le champ ; une saisie en cours,
  // qui remet la sélection à vide, n'est pas écrasée
  useEffect(() => {
    if (value) setSearch(selectedLabel);
  }, [value, selectedLabel]);

  useEffect(() => {
    if (!isOpen) return;
    const dismissOnClickOutside = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnClickOutside);
    return () => document.removeEventListener('pointerdown', dismissOnClickOutside);
  }, [isOpen]);

  const results = useMemo(() => {
    const query = normalize(search);
    if (!query) return [];
    return options.filter((option) => normalize(option.label ?? '').includes(query));
  }, [options, search]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsOpen(true);
    setSearch(e.target.value);
    if (value) onSelect(null);
  };

  const query = search.trim();
  // comme InputVille : la liste n'apparaît qu'une fois la saisie commencée
  const isVisible = isOpen && !!query;

  return (
    <div ref={containerRef}>
      <Input
        label={label}
        hintText={hintText}
        nativeInputProps={{
          id: inputId,
          name: inputId,
          type: 'text',
          autoComplete: 'off',
          required: true,
          placeholder: 'Tapez le nom du destinataire',
          value: search,
          onChange: handleChange,
          onKeyDown: (e) => {
            if (e.key === 'Escape') setIsOpen(false);
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
          results.map((option) => {
            return (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
                type="button"
                className="block border-b-2! border-b-gray-200 py-1 pl-4 text-left"
              >
                {option.label}
              </button>
            );
          })}
        {isVisible && results.length === 0 && (
          <button
            onClick={() => {
              setIsOpen(false);
              onCreate(query);
            }}
            type="button"
            className="block py-2 pl-4 text-left font-bold text-(--text-action-high-blue-france)"
          >
            {`Créer « ${query} »`}
          </button>
        )}
      </div>
    </div>
  );
}
