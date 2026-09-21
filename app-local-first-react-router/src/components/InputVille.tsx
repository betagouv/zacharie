import { Input, InputProps } from '@codegouvfr/react-dsfr/Input';
import { useState, ChangeEvent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDebounce } from '@uidotdev/usehooks';
import { searchVilles } from '@app/utils/search-ville';

interface InputVilleProps extends InputProps.RegularInput {
  trimPostCode?: boolean;
  postCode?: string;
  // id du champ code postal : la liste s'affiche sous ce champ quand c'est lui qui la déclenche
  postCodeInputId?: string;
  onSelect?: (ville: string) => void;
  // la commune choisie porte son code postal : on le renvoie pour mettre à jour le champ dédié
  onSelectPostCode?: (postCode: string) => void;
}
export default function InputVille(props: InputVilleProps) {
  const { trimPostCode, postCode, postCodeInputId, onSelect, onSelectPostCode, ...inputProps } = props;
  const [villeSearched, setVilleSearched] = useState<string>(() => {
    const defaultValue = props.nativeInputProps?.defaultValue;
    return typeof defaultValue === 'string' ? defaultValue : '';
  });
  const [isOpen, setIsOpen] = useState(false);
  const [openedFrom, setOpenedFrom] = useState<'ville' | 'postCode'>('ville');
  const debouncedSearch = useDebounce(`${postCode ? postCode + ' ' : ''}${villeSearched}`, 300);
  const [villesResults, setVillesResults] = useState<string[]>([]);

  const listRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLInputElement>(null);

  // la liste est recalculée à chaque changement de code postal ou de saisie : elle ne propose
  // jamais les communes d'un code postal précédent
  useEffect(() => {
    if (!isOpen) {
      setVillesResults([]);
      return;
    }
    setVillesResults(searchVilles(debouncedSearch));
  }, [debouncedSearch, isOpen]);

  // le code postal est saisi avant la ville : dès qu'il est complet on propose ses communes
  useEffect(() => {
    if (!villeSearched && postCode && postCode.length >= 5) {
      setOpenedFrom('postCode');
      setIsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postCode]);

  const postCodeGroup =
    openedFrom === 'postCode' && postCodeInputId ? findPostCodeGroup(ref.current, postCodeInputId) : null;

  useEffect(() => {
    if (!isOpen) return;
    const dismissOnClickOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.closest('.fr-input-group')?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      if (postCodeGroup?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnClickOutside);
    return () => document.removeEventListener('pointerdown', dismissOnClickOutside);
  }, [isOpen, postCodeGroup]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setOpenedFrom('ville');
    setIsOpen(true);
    setVilleSearched(e.target.value);
  };

  const villesList =
    villesResults.length === 0 ? null : (
      <div
        ref={listRef}
        className={[
          'flex max-h-60 w-full flex-col overflow-y-auto border border-gray-200',
          postCodeGroup ? '' : '-mt-6',
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
                  if (onSelectPostCode) onSelectPostCode(codePostal);
                } else {
                  setVilleSearched(ville);
                  if (onSelect) onSelect(ville);
                }
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
    );

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
          onFocus: (e) => {
            setOpenedFrom('ville');
            props.nativeInputProps?.onFocus?.(e);
          },
          onKeyDown: (e) => {
            if (e.key === 'Escape') setIsOpen(false);
            props.nativeInputProps?.onKeyDown?.(e);
          },
        }}
      />
      {villesList && (postCodeGroup ? createPortal(villesList, postCodeGroup) : villesList)}
    </>
  );
}

// plusieurs formulaires de la page peuvent porter le même id de champ code postal : on remonte
// depuis le champ ville pour trouver celui du même bloc
function findPostCodeGroup(from: HTMLElement | null, postCodeInputId: string): HTMLElement | null {
  let node = from?.parentElement ?? null;
  while (node) {
    const input = node.querySelector(`#${CSS.escape(postCodeInputId)}`);
    if (input) return input.closest('.fr-input-group');
    node = node.parentElement;
  }
  return null;
}
