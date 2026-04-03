import { useCallback, useEffect, useRef, useState } from 'react';

interface MultiSelectOption {
  value: string;
  label: string;
  isActive: boolean;
}

interface MultiSelectDropDownMenuProps {
  text: string;
  isActive: boolean;
  options: MultiSelectOption[];
  onToggle: (value: string) => void;
  onClear: () => void;
  clearLabel: string;
  className?: string;
}

export default function MultiSelectDropDownMenu({
  text,
  isActive,
  options,
  onToggle,
  onClear,
  clearLabel,
  className = '',
}: MultiSelectDropDownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClickOutside]);

  return (
    <div ref={containerRef} className={`drop-down ${className}`} style={{ position: 'relative' }}>
      <div className="fr-nav__item" style={{ position: 'relative' }}>
        <button
          className="fr-nav__btn fr-btn--tertiary"
          aria-expanded={isOpen}
          aria-current={isActive ? 'page' : undefined}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {text}
        </button>
        {isOpen && (
          <div className="fr-menu" style={{ display: 'block' }}>
            <ul className="fr-menu__list">
              <li>
                <button
                  type="button"
                  className="fr-nav__link"
                  aria-current={!isActive ? 'page' : undefined}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={() => onClear()}
                >
                  {clearLabel}
                </button>
              </li>
              {options.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className="fr-nav__link"
                    aria-current={option.isActive ? 'page' : undefined}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onClick={() => onToggle(option.value)}
                  >
                    {option.isActive ? '✓ ' : '\u00A0\u00A0\u00A0'}
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
