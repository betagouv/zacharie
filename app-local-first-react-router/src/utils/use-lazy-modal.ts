import { useCallback, useRef, useState } from 'react';
import { createModal } from '@app/components/Modal';

export type LazyModalInstance = ReturnType<typeof createModal>;

// Modale DSFR montée seulement à sa première ouverture, à rendre avec <LazyModal>.
// Dans une liste de cartes, une modale montée d'office par carte coûte un <dialog> et un
// MutationObserver sur tout le document (useIsModalOpen) : avec 300 carcasses, chaque rendu
// de la page déclenche des centaines d'observers et l'ajout d'une carcasse ralentit.
export function useLazyModal(id: string) {
  const modal = useRef(createModal({ id, isOpenedByDefault: false })).current;
  const [isMounted, setIsMounted] = useState(false);
  const isMountedRef = useRef(false);

  const open = useCallback(() => {
    if (isMountedRef.current) {
      modal.open();
      return;
    }
    // la première ouverture se fait au montage de <LazyModal>
    isMountedRef.current = true;
    setIsMounted(true);
  }, [modal]);

  return { modal, isMounted, open, close: modal.close };
}
