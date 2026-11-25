import { type ComponentProps, type ReactNode, useEffect } from 'react';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import type { LazyModalInstance } from '@app/utils/use-lazy-modal';

type LazyModalProps = Omit<ComponentProps<LazyModalInstance['Component']>, 'children'> & {
  modal: LazyModalInstance;
  children: (isOpen: boolean) => ReactNode;
};

export default function LazyModal({ modal, children, ...props }: LazyModalProps) {
  const isOpen = useIsModalOpen(modal);

  useEffect(() => {
    modal.open();
  }, [modal]);

  return <modal.Component {...props}>{children(isOpen)}</modal.Component>;
}
