import { useEffect, useState } from 'react';

const TRIGGER = 'zacharie';

// on ne lit pas les touches tapées dans un champ : seulement celles tapées sur la page
function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// Easter egg : taper « zacharie » sur la page de la fiche (hors d'un champ) ouvre l'assistant de saisie.
export default function useZacharieEasterEgg(enabled: boolean) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled || isOpen) return;
    let buffer = '';
    const onKeyDown = (event: KeyboardEvent) => {
      // l'autoremplissage du navigateur envoie des keydown sans `key`
      if (event.key?.length !== 1 || isEditable(event.target)) return;
      buffer = (buffer + event.key.toLowerCase()).slice(-TRIGGER.length);
      if (buffer === TRIGGER) setIsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, isOpen]);

  return { isOpen, close: () => setIsOpen(false) };
}
