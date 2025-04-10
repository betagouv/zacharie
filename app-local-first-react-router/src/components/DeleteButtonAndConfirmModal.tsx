import { useState, useRef } from 'react';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { Button } from '@codegouvfr/react-dsfr/Button';

interface DeleteButtonAndConfirmModalProps {
  title: string;
  buttonText?: string;
  children?: React.ReactNode;
  textToConfirm: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  disabledTitle?: string;
}

const DeleteButtonAndConfirmModal = ({
  title,
  children,
  textToConfirm,
  onConfirm,
  buttonText = 'Supprimer',
  disabled = false,
  className = '',
  disabledTitle = "Vous n'avez pas le droit de supprimer cet élément",
}: DeleteButtonAndConfirmModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const modal = useRef(
    createModal({
      id: `delete-modal-${textToConfirm}`,
      isOpenedByDefault: false,
    }),
  ).current;

  return (
    <>
      <Button
        title={disabled ? disabledTitle : title}
        onClick={() => {
          setResetKey(resetKey + 1);
          modal.open();
        }}
        disabled={disabled}
        iconId="fr-icon-delete-line"
        priority="tertiary"
        className={['bg-red-500 text-white', className].join(' ')}
      >
        {buttonText}
      </Button>

      <modal.Component
        size="large"
        title={<span className="fr-text--red-marianne">{title}</span>}
        buttons={[
          {
            children: 'Annuler',
            disabled: isDeleting,
            onClick: () => modal.close(),
          },
          {
            children: 'Supprimer',
            disabled: isDeleting,
            type: 'button',
            nativeButtonProps: {
              onClick: () => {
                setIsDeleting(true);
                onConfirm();
                modal.close();
                setIsDeleting(false);
              },
            },
          },
        ]}
      >
        {children}
      </modal.Component>
    </>
  );
};

export default DeleteButtonAndConfirmModal;
