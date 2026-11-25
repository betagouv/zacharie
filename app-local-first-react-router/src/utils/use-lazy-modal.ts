import { useCallback, useRef, useState } from 'react';
import { createModal } from '@app/components/Modal';

export type LazyModalInstance = ReturnType<typeof createModal>;

export function useLazyModal(id: string) {
  const modal = useRef(createModal({ id, isOpenedByDefault: false })).current;
  const [isMounted, setIsMounted] = useState(false);
  const isMountedRef = useRef(false);

  const open = useCallback(() => {
    if (isMountedRef.current) {
      modal.open();
      return;
    }
    isMountedRef.current = true;
    setIsMounted(true);
  }, [modal]);

  return { modal, isMounted, open, close: modal.close };
}
