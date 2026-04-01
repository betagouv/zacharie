import type { Ref } from 'react';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { formatAdminUserDate } from './admin-user-state';
import { toast } from 'react-toastify';

type AdminUserTabDetailsProps = {
  user: User;
  activeFormRef: Ref<HTMLFormElement>;
  onActiveBlur: () => void;
};

export default function AdminUserTabDetails({ user, activeFormRef, onActiveBlur }: AdminUserTabDetailsProps) {
  async function copyId() {
    try {
      await navigator.clipboard.writeText(user.id);
      toast.success('Identifiant copié');
    } catch {
      toast.error('Impossible de copier');
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="fr-mb-2w text-base font-semibold text-[#161616]">Statut</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag small>{user.activated ? 'Actif' : 'Inactif'}</Tag>
            {user.isZacharieAdmin ? <Tag small>Admin Zacharie</Tag> : null}
          </div>
          <form
            id="user_active_form"
            method="POST"
            ref={activeFormRef}
            onBlur={onActiveBlur}
            onSubmit={(event) => event.preventDefault()}
            className="rounded-md border border-gray-200 bg-[#fafafa] px-3 py-2"
          >
            <RadioButtons
              key={user.activated ? 'true' : 'false'}
              legend="État du compte"
              classes={{ legend: 'fr-text--sm fr-mb-1w fr-text--bold' }}
              small
              orientation="horizontal"
              options={[
                {
                  label: 'Activé',
                  nativeInputProps: {
                    name: Prisma.UserScalarFieldEnum.activated,
                    value: 'true',
                    onChange: !user.activated ? onActiveBlur : undefined,
                    defaultChecked: user.activated,
                  },
                },
                {
                  label: 'Inactif',
                  nativeInputProps: {
                    name: Prisma.UserScalarFieldEnum.activated,
                    value: 'false',
                    onChange: user.activated ? onActiveBlur : undefined,
                    defaultChecked: !user.activated,
                  },
                },
              ]}
            />
          </form>
        </div>
      </section>

      <section>
        <h2 className="fr-mb-2w text-base font-semibold text-[#161616]">Références et dates</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 rounded border border-gray-100 bg-[#fafafa] p-2">
            <dt className="text-xs font-medium text-[#666]">Identifiant</dt>
            <dd className="fr-mb-0 mt-1 flex flex-wrap items-center gap-1.5">
              <code className="block max-w-full truncate rounded bg-white px-1.5 py-0.5 text-xs">{user.id}</code>
              <Button onClick={() => void copyId()} priority="tertiary no outline" size="small">
                Copier
              </Button>
            </dd>
          </div>

          <div className="rounded border border-gray-100 bg-[#fafafa] p-2">
            <dt className="text-xs font-medium text-[#666]">Création du compte</dt>
            <dd className="fr-mb-0 mt-1">{formatAdminUserDate(user.created_at)}</dd>
          </div>

          <div className="rounded border border-gray-100 bg-[#fafafa] p-2">
            <dt className="text-xs font-medium text-[#666]">Dernière connexion</dt>
            <dd className="fr-mb-0 mt-1">{formatAdminUserDate(user.last_login_at)}</dd>
          </div>

          <div className="rounded border border-gray-100 bg-[#fafafa] p-2">
            <dt className="text-xs font-medium text-[#666]">Onboarding terminé</dt>
            <dd className="fr-mb-0 mt-1">{formatAdminUserDate(user.onboarded_at)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
