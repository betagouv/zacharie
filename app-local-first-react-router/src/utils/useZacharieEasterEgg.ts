import { useEffect, useState } from 'react';

const TRIGGER = 'zacharie';

// on ne lit pas les touches tapées dans un champ : seulement celles tapées sur la page
function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// sur mobile, pas de clavier hors d'un champ : on tape 5 fois vite sur la page, hors d'un bouton ou d'un lien
const TAPS = 5;
const TAP_DELAY_MS = 500;

function isInteractive(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest('a, button, input, textarea, select, label, [role="button"], [contenteditable]');
}

// Easter egg : taper « zacharie » sur la page de la fiche (hors d'un champ), ou la toucher 5 fois de
// suite sur mobile, ouvre l'assistant de saisie.
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
    let taps = 0;
    let lastTap = 0;
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || isInteractive(event.target)) return;
      taps = event.timeStamp - lastTap < TAP_DELAY_MS ? taps + 1 : 1;
      lastTap = event.timeStamp;
      if (taps >= TAPS) setIsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [enabled, isOpen]);

  return { isOpen, close: () => setIsOpen(false) };
}
