import { Input } from '@app/components/Input';
import { useState, ChangeEvent, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { searchDestinataires } from '@app/utils/search-destinataire';

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

  const results = useMemo(() => searchDestinataires(options, search), [options, search]);
  const canCreate = results.every((result) => result.isFuzzy);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsOpen(true);
    setSearch(e.target.value);
    if (value) onSelect(null);
  };

  const query = search.trim();
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
      <div
        className={
          isVisible ? '-mt-6 flex max-h-60 w-full flex-col overflow-y-auto border border-gray-200' : 'hidden'
        }
      >
        {isVisible &&
          results.map(({ option }) => {
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
        {isVisible && canCreate && (
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
