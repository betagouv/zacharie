import type { Ref } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import type { User } from '@prisma/client';
import RolesCheckBoxes from '@app/components/RolesCheckboxes';

type AdminUserTabRolesProps = {
  user: User;
  rolesFormRef: Ref<HTMLFormElement>;
  onRolesBlur: () => void;
};

export default function AdminUserTabRoles({ user, rolesFormRef, onRolesBlur }: AdminUserTabRolesProps) {
  return (
    <form
      id="user_roles_form"
      method="POST"
      ref={rolesFormRef}
      onBlur={onRolesBlur}
      onSubmit={(event) => event.preventDefault()}
    >
      <RolesCheckBoxes withAdmin user={user} legend="Sélectionnez tous les rôles de cet utilisateur" />
      <div className="relative flex w-full flex-col border-t border-gray-100 bg-white p-3 pb-2 shadow-2xl md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
        <ButtonsGroup
          buttons={[
            {
              children: 'Enregistrer',
              type: 'submit',
              nativeButtonProps: {
                form: 'user_roles_form',
              },
            },
          ]}
        />
      </div>
    </form>
  );
}
