import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import RolesCheckBoxes from '@app/components/RolesCheckboxes';
import { Prisma, type User, UserRoles } from '@prisma/client';
import useUser from '@app/zustand/user';
import type { UserConnexionResponse } from '@api/src/types/responses';
import { useNavigate } from 'react-router';
import API from '@app/services/api';

export default function MesRoles() {
  const user = useUser((state) => state.user)!;
  const navigate = useNavigate();

  console.log(user.roles);

  return (
    <form
      id="user_roles_form"
      method="POST"
      onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const roles = formData.getAll(Prisma.UserScalarFieldEnum.roles);
        const body: Partial<User> = { roles: roles as UserRoles[] };
        const response = await API.post({
          path: `user/${user.id}`,
          body,
        }).then((data) => data as UserConnexionResponse);
        if (response.ok && response.data?.user?.id) {
          useUser.setState({ user: response.data.user });
          navigate('/app/tableau-de-bord/mon-profil/mes-coordonnees');
        }
      }}
    >
      <title>Mon activité | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Stepper currentStep={1} nextTitle="Mes coordonnées" stepCount={4} title="Mon activité" />
            <h1 className="fr-h2 fr-mb-2w">Renseignez votre activité</h1>
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 pb-32 md:p-8 md:pb-0">
                {user.roles.includes(UserRoles.ADMIN) && (
                  <input type="hidden" name={Prisma.UserScalarFieldEnum.roles} value={UserRoles.ADMIN} />
                )}
                <RolesCheckBoxes
                  user={user}
                  legend="Sélectionnez l’activité qui vous correspond"
                  withAdmin={user.roles.includes(UserRoles.ADMIN)}
                  onlyChasseur={!user.roles.length || user.roles.includes(UserRoles.CHASSEUR)}
                />
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
              <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: 'Continuer',
                      nativeButtonProps: {
                        type: 'submit',
                      },
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
