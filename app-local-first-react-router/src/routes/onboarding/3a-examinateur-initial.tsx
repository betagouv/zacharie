import { useEffect,useState, useCallback } from 'react';

import { useNavigate, useSearchParams } from 'react-router';
import { UserRoles, Prisma } from '@prisma/client';

import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';

import useUser from '@app/zustand/user';
import API from '@app/services/api';

import type { UserConnexionResponse } from '@api/src/types/responses';

export default function OnboardingExaminateurInitial() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const user = useUser((state) => state.user)!;
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const nextPage = '/app/tableau-de-bord/onboarding/mes-informations-de-chasse';

  // If user is not a hunter, skip this step
  useEffect(() => {
    if (!user.roles.includes(UserRoles.CHASSEUR)) {
      navigate(redirect ?? nextPage);
    }
  }, [user.roles, navigate, redirect, nextPage]);

  if (!user.roles.includes(UserRoles.CHASSEUR)) {
    return null;
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>{`Formation examen initial | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper
            currentStep={3}
            nextTitle="Mes informations de chasse"
            stepCount={5}
            title="Formation à l'examen initial"
          />
          <h1 className="fr-h2 fr-mb-2w">Êtes-vous formé à l'examen initial ?</h1>
          <CallOut title="⚠️ Information importante" className="bg-white">
            Cette information déterminera si vous pouvez créer des fiches d'examen initial.
          </CallOut>
          <ExaminateurInitial />
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: 'Continuer',
                    type: 'button',
                    nativeButtonProps: {
                      onClick: () => navigate(redirect ?? nextPage),
                    },
                  },
                  {
                    children: redirect ? 'Retour' : 'Modifier mes coordonnées',
                    linkProps: {
                      to: redirect ?? '/app/tableau-de-bord/onboarding/mes-coordonnees',
                      href: '#',
                    },
                    priority: 'secondary',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

 function ExaminateurInitial() {
  const user = useUser((state) => state.user)!;

  const [isExaminateurInitial, setIsExaminateurInitial] = useState(user.est_forme_a_l_examen_initial);
  const [numeroCfei, setNumeroCfei] = useState(user.numero_cfei ?? '');

  const handleUserSubmit = useCallback(
    async ({
      isExaminateurInitial,
      numeroCfei,
    }: {
      isExaminateurInitial: boolean | null;
      numeroCfei: string;
    }) => {
      const body: Record<string, string | null> = {};
      if (isExaminateurInitial) {
        body.est_forme_a_l_examen_initial = 'true';
        body.numero_cfei = numeroCfei || null;
      } else {
        body.est_forme_a_l_examen_initial = 'false';
        body.numero_cfei = null;
      }
      const response = await API.post({
        path: `/user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  if (!user.roles.includes(UserRoles.CHASSEUR)) {
    return null;
  }

  return (
    <div className="mb-6 bg-white md:shadow-sm">
      <div className="p-4 md:p-8">
        <form id="examinateur_initial_form" method="POST" onSubmit={(e) => e.preventDefault()}>
          <RadioButtons
            legend="Êtes-vous formé à l'examen initial ? *"
            orientation="horizontal"
            options={[
              {
                nativeInputProps: {
                  required: true,
                  checked: isExaminateurInitial === true,
                  name: Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial,
                  onChange: () => {
                    setIsExaminateurInitial(true);
                    handleUserSubmit({ isExaminateurInitial: true, numeroCfei });
                  },
                },
                label: 'Oui',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: isExaminateurInitial === false,
                  name: 'pas_forme_a_l_examen_initial',
                  onChange: () => {
                    if (
                      !user.numero_cfei ||
                      window.confirm("N'êtes vous vraiment pas formé à l'examen initial ?")
                    ) {
                      setIsExaminateurInitial(false);
                      handleUserSubmit({
                        isExaminateurInitial: false,
                        numeroCfei,
                      });
                    }
                  },
                },
                label: 'Non',
              },
            ]}
          />
          {user.roles.includes(UserRoles.CHASSEUR) && isExaminateurInitial && (
            <Input
              label="Numéro d'attestation de Chasseur Formé à l'Examen Initial *"
              hintText="De la forme CFEI-DEP-AA-123"
              key={isExaminateurInitial ? 'true' : 'false'}
              nativeInputProps={{
                id: Prisma.UserScalarFieldEnum.numero_cfei,
                name: Prisma.UserScalarFieldEnum.numero_cfei,
                onBlur: () => handleUserSubmit({ isExaminateurInitial, numeroCfei }),
                autoComplete: 'off',
                required: true,
                value: numeroCfei,
                onChange: (e) => {
                  setNumeroCfei(e.currentTarget.value);
                },
              }}
            />
          )}
        </form>
      </div>
    </div>
  );
}
