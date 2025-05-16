import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { EntityTypes, EntityRelationType, Entity, Prisma } from '@prisma/client';
import type { UserCCGsResponse, UserEntityResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export default function MesCCGs() {
  // const removeCCGFetcher = useFetcher({ key: 'ccg-remove' });
  const [userCCGs, setUserCCGs] = useState<Array<Entity>>([]);
  const user = useUser((state) => state.user)!;
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch(`${import.meta.env.VITE_API_URL}/user/my-ccgs`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .then((res) => res as UserCCGsResponse)
      .then((res) => {
        if (res.ok) {
          setUserCCGs(res.data.userCCGs);
        }
      });
  }, []);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Mes centres de collecte | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper
            currentStep={3}
            // stepCount={4}
            stepCount={3}
            title="Vos Centres de Collectes du Gibier sauvage"
            // nextTitle="Vos notifications"
          />
          <h1 className="fr-h2 fr-mb-2w">Identifiez vos CCGs</h1>
          <CallOut className="bg-white">
            Si vous utilisez un Centre de Collecte du Gibier sauvage (CCG) pour entreposer votre gibier, vous
            pouvez l'identifier ici.
          </CallOut>
          <CallOut colorVariant="purple-glycine" className="bg-white">
            <strong>
              Attention: seuls les CCGs enregistrés par le Ministère de l'Agriculture sont disponibles.
            </strong>
            <br /> Si ce n'est pas encore fait, la démarche est simple et rapide,{' '}
            <a
              // href="https://entreprendre.service-public.fr/vosdroits/R44572"
              href="https://mesdemarches.agriculture.gouv.fr/demarches/association-ou-organisation-de/assurer-une-activite-de-76/article/declarer-la-manipulation-de"
              className="fr-link fr-link--icon-right text-lg"
            >
              disponible ici
            </a>
            .
            <br />
            Contactez-nous ensuite pour que nous l'enregistrions dans Zacharie.
          </CallOut>
          <div className="mb-6 bg-white md:shadow">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              {!userCCGs.length && (
                <p className="mb-4 text-lg font-bold">
                  Cette étape est facultative.
                  <br />
                  Vous pouvez la passer si vous n'avez aucun lien avec un CCG.
                  <br />
                  Vous pouvez aussi la faire plus tard.
                </p>
              )}
              {userCCGs.map((entity) => {
                return (
                  <Notice
                    className="fr-text-default--grey fr-background-contrast--grey mb-4 [&_p.fr-notice__title]:before:hidden"
                    style={{
                      boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
                    }}
                    isClosable
                    onClose={() => {
                      fetch(`${import.meta.env.VITE_API_URL}/user/user-entity/${user.id}`, {
                        method: 'POST',
                        credentials: 'include',
                        body: JSON.stringify({
                          _action: 'delete',
                          [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                          [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                          relation: EntityRelationType.WORKING_WITH,
                        }),
                        headers: {
                          Accept: 'application/json',
                          'Content-Type': 'application/json',
                        },
                      })
                        .then((res) => res.json())
                        .then((res) => {
                          if (res.ok) {
                            setUserCCGs((prev) => prev.filter((ccg) => ccg.id !== entity.id));
                          }
                        });
                    }}
                    title={
                      <>
                        {entity.numero_ddecpp}
                        <br />
                        {entity.nom_d_usage}
                        <br />
                        {entity.code_postal} {entity.ville}
                      </>
                    }
                  />
                );
              })}
              <InputCCG addCCG={(ccg) => setUserCCGs([...userCCGs, ccg])} />
              <div className="mb-16 ml-6 mt-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: 'Continuer',
                    linkProps: {
                      // to: redirect || '/app/tableau-de-bord/mon-profil/mes-notifications',
                      to: redirect || '/app/tableau-de-bord',
                      href: '#',
                    },
                  },
                  {
                    children: redirect ? 'Retour' : 'Modifier mes informations',
                    linkProps: {
                      to: redirect || '/app/tableau-de-bord/mon-profil/mes-informations',
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

function InputCCG({ addCCG }: { addCCG: (ccg: Entity) => void }) {
  const user = useUser((state) => state.user)!;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      method="POST"
      className="flex w-full flex-row items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        fetch(`${import.meta.env.VITE_API_URL}/user/user-entity/${user.id}`, {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            _action: 'create',
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            relation: EntityRelationType.WORKING_WITH,
            [Prisma.EntityScalarFieldEnum.numero_ddecpp]: formData.get(
              Prisma.EntityScalarFieldEnum.numero_ddecpp,
            ),
            [Prisma.EntityScalarFieldEnum.type]: EntityTypes.CCG,
          }),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        })
          .then((res) => res.json())
          .then((res) => res as UserEntityResponse)
          .then((res) => {
            setIsSubmitting(false);
            if (res.ok && res.data.entity) {
              setError('');
              addCCG(res.data.entity);
            }
            if (res.error) {
              setError(res.error);
            }
          });
      }}
    >
      <Input
        label="Numéro du Centre de Collecte du Gibier sauvage (CCG)"
        className="!mb-0"
        hintText={
          <a href="https://entreprendre.service-public.fr/vosdroits/R44572" className="bg-none">
            Votre CCG n'est pas encore enregistré ? Contactez-nous pour que nous l'ajoutions. Si vous ne
            l'avez pas encore enregistré auprès du ministère,{' '}
            <u className="inline">faites-le en cliquant ici</u>.
          </a>
        }
        state={error ? 'error' : 'default'}
        stateRelatedMessage={error}
        nativeInputProps={{
          type: 'text',
          required: true,
          name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
        }}
      />
      <Button type="submit" disabled={isSubmitting}>
        {!isSubmitting ? 'Ajouter' : 'Recherche en cours...'}
      </Button>
    </form>
  );
}
