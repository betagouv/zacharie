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

// DSFR enregistre les <dialog> de façon asynchrone : juste après le montage (lent sur certaines WebView
// Android), `window.dsfr(element)` renvoie encore null et `open()` du composant DSFR plante
// (« Cannot read properties of null (reading 'modal') »). On réessaie aux frames suivantes.
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
  // Une modale retirée de la page encore ouverte (ex. bouton « retour » d'Android) reste « ouverte » pour
  // DSFR : son piège à focus s'accroche à la modale détachée et plante sur ses boutons radio
  // (« Cannot read properties of undefined (reading 'keep') »), puis à chaque modale ajoutée ou retirée.
  // On la ferme au démontage, tant qu'elle est encore dans la page (cleanup de layout effect).
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
