import { type ComponentProps, type ReactNode, useEffect } from 'react';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import type { LazyModalInstance } from '@app/utils/use-lazy-modal';

type LazyModalProps = Omit<ComponentProps<LazyModalInstance['Component']>, 'children'> & {
  modal: LazyModalInstance;
  // reçoit l'état ouvert/fermé, pour ne rendre le contenu lourd que modale ouverte
  children: (isOpen: boolean) => ReactNode;
};

// À rendre seulement quand `useLazyModal().isMounted` est vrai : s'ouvre à son montage.
export default function LazyModal({ modal, children, ...props }: LazyModalProps) {
  const isOpen = useIsModalOpen(modal);

  // déclaré après useIsModalOpen : ses écouteurs sont posés avant l'ouverture
  useEffect(() => {
    modal.open();
  }, [modal]);

  return <modal.Component {...props}>{children(isOpen)}</modal.Component>;
}
