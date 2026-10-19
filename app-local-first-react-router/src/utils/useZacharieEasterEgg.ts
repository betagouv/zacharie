import { useEffect, useState } from 'react';

const TRIGGER = 'zacharie';

// Easter egg : taper « zacharie » sur la page de la fiche ouvre l'assistant de saisie.
// Au clavier physique on lit les touches ; dans un champ (clavier mobile, dictée) on lit la valeur saisie,
// car les claviers virtuels envoient souvent des keydown sans `key` exploitable.
export default function useZacharieEasterEgg(enabled: boolean) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled || isOpen) return;
    let buffer = '';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.length !== 1) return;
      buffer = (buffer + event.key.toLowerCase()).slice(-TRIGGER.length);
      if (buffer === TRIGGER) setIsOpen(true);
    };
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (typeof target?.value !== 'string') return;
      if (!target.value.toLowerCase().includes(TRIGGER)) return;
      target.blur();
      setIsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('input', onInput, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('input', onInput, true);
    };
  }, [enabled, isOpen]);

  return { isOpen, close: () => setIsOpen(false) };
}
