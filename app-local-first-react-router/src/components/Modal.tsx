import { useLayoutEffect } from 'react';
// eslint-disable-next-line no-restricted-imports
import { createModal as createDsfrModal, type ModalProps } from '@codegouvfr/react-dsfr/Modal';
import { capture } from '@app/services/sentry';

export type { ModalProps };

const MAX_ATTEMPTS = 10;

type DsfrModalInstance = { disclose: () => void; conceal: () => void; isDisclosed: boolean };

function getDsfrModal(id: string): DsfrModalInstance | null {
  const element = document.getElementById(id);
  if (!element) return null;
  // @ts-expect-error: window.dsfr est posé par le script DSFR
  const instance = window.dsfr?.(element);
  return instance?.modal ?? null;
}

function runWhenReady(id: string, action: 'disclose' | 'conceal', attempt = 0) {
  const modal = getDsfrModal(id);
  if (modal) {
    modal[action]();
    return;
  }
  if (attempt >= MAX_ATTEMPTS) {
    capture(`Modale DSFR introuvable après ${MAX_ATTEMPTS} essais`, { extra: { id, action } });
    return;
  }
  window.requestAnimationFrame(() => runWhenReady(id, action, attempt + 1));
}

export function createModal(params: Parameters<typeof createDsfrModal>[0]) {
  const modal = createDsfrModal(params);
  function Component(props: Parameters<typeof modal.Component>[0]) {
    useLayoutEffect(() => {
      return () => {
        const dsfrModal = getDsfrModal(modal.id);
        if (dsfrModal?.isDisclosed) dsfrModal.conceal();
      };
    }, []);
    return <modal.Component {...props} />;
  }
  return {
    ...modal,
    Component,
    open: () => runWhenReady(modal.id, 'disclose'),
    close: () => runWhenReady(modal.id, 'conceal'),
  };
}
