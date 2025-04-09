import { useState, useRef } from 'react';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';

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
            type: 'submit',
            nativeButtonProps: {
              form: `delete-${textToConfirm}`,
            },
          },
        ]}
      >
        {children}
        <p className="fr-text--center fr-mb-3w">
          Veuillez taper le texte ci-dessous pour confirmer
          <br />
          en respectant les majuscules, minuscules ou accents
        </p>
        <p className="fr-text--center">
          <span className="fr-text--red-marianne fr-text--bold">{textToConfirm}</span>
        </p>
        <form
          key={resetKey}
          id={`delete-${textToConfirm}`}
          onSubmit={async (e) => {
            e.preventDefault();
            const _textToConfirm = String(Object.fromEntries(new FormData(e.currentTarget))?.textToConfirm);
            if (!_textToConfirm) {
              return alert('Veuillez rentrer le texte demandé');
            }
            if (_textToConfirm.trim().toLocaleLowerCase() !== textToConfirm.trim().toLocaleLowerCase()) {
              return alert('Le texte renseigné est incorrect');
            }
            if (_textToConfirm.trim() !== textToConfirm.trim()) {
              return alert('Veuillez respecter les minuscules/majuscules');
            }
            setIsDeleting(true);
            onConfirm();
            modal.close();
            setIsDeleting(false);
          }}
        >
          <Input
            className="fr-col-6"
            label=" " // empty label to maintain spacing
            nativeInputProps={{
              name: 'textToConfirm',
              autoComplete: 'off',
              placeholder: textToConfirm,
            }}
          />
        </form>
      </modal.Component>
    </>
  );
};

export default DeleteButtonAndConfirmModal;
