import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface FullScreenOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

export default function FullScreenOverlay({
  isOpen,
  onClose,
  children,
  ariaLabel = 'Détails',
}: FullScreenOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/50 backdrop-blur-[2px] md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl md:h-[95vh] md:max-h-[95vh] md:w-[95vw] md:max-w-[1400px] md:rounded-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span
            className="fr-icon-close-line"
            aria-hidden="true"
          />
        </button>
        <div className="flex-1 overflow-y-auto px-4 pt-12 pb-4 md:px-8 md:pt-10 md:pb-8">{children}</div>
      </div>
    </div>,
    document.body
  );
}
