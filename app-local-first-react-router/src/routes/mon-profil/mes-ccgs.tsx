import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { EntityTypes, EntityRelationType, Entity, Prisma } from '@prisma/client';
import type { UserCCGsResponse, UserConnexionResponse, UserEntityResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import InputVille from '@app/components/InputVille';

export default function MesCCGs() {
  // const removeCCGFetcher = useFetcher({ key: 'ccg-remove' });
  const [userCCGs, setUserCCGs] = useState<Array<Entity>>([]);
  const user = useUser((state) => state.user)!;
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  function refreshUserCCGs() {
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
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    refreshUserCCGs();
  }, []);

  const [newCCGExpanded, setNewCCGExpanded] = useState(false);
  const [ccgPostalCode, setCCGPostalCode] = useState('');
  const handleNewCCGSubmit = useCallback(async (event: React.FocusEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body: Partial<Entity> = Object.fromEntries(formData.entries());
    const response = await fetch(`${import.meta.env.VITE_API_URL}/entite/ccg`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(body),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => data as UserConnexionResponse);
    if (response.ok) {
      refreshUserCCGs();
      setCCGPostalCode('');
      setNewCCGExpanded(false);
      document.getElementById('onboarding-etape-2-ccgs-data')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  function RegisterCCG() {
    return (
      <p className="mt-4 text-sm">
        <br />
        Le CCG identifié dans Zacharie peut être utilisé pour entreposer du gibier. Toutefois, il est
        important de reconnaître officiellement le CCG en procédant à son enregistrement auprès de la
        direction départementale en charge de la protection des populations (DDPP/DDETSPP) du département
        d’implantation du CCG.
        <br />
        Pour déclarer l’activité du CCG, il vous suffit de suivre la procédure suivante&nbsp;:
        <ol className="list-inside list-decimal">
          <li>
            Remplir le formulaire de déclaration d’activité à télécharger sur le lien suivant&nbsp;:{' '}
            <a
              target="_blank"
              rel="noreferrer noopener"
              href="https://mesdemarches.agriculture.gouv.fr/demarches/association-ou-organisation-de/assurer-une-activite-de-76/article/declarer-la-manipulation-de"
            >
              https://mesdemarches.agriculture.gouv.fr/demarches/association-ou-organisation-de/assurer-une-activite-de-76/article/declarer-la-manipulation-de
            </a>
            <br />
            Un document d’aide au remplissage du formulaire est accessible{' '}
            <a
              href="https://scribehow.com/shared/Declarer_un_centre_de_collecte_de_gibier_CCG__f9XrNsQYQx68Mk-WDBJr0w"
              target="_blank"
              rel="noreferrer noopener"
            >
              ici
            </a>
            .
          </li>
          <li>
            Envoyer la déclaration d’activité remplie, datée et signée à la DDPP/DDETSPP compétente par
            courrier postal.
            <br />
            Les coordonnées des DDPP/DDETSPP sont accessibles via le lien suivant&nbsp;:
            <a
              href="https://agriculture.gouv.fr/ddpp-et-ddets-pp-tous-les-contacts-des-services-deconcentres"
              target="_blank"
              rel="noreferrer noopener"
            >
              https://agriculture.gouv.fr/ddpp-et-ddets-pp-tous-les-contacts-des-services-deconcentres
            </a>
          </li>
          <li>
            Attendre l’accusé de réception. Un numéro d’identification unique sera attribué au CCG permettant
            d’assurer la traçabilité et faciliter la valorisation des viandes.
          </li>
          <li>Le numéro d’identification est automatiquement enregistré dans Zacharie.</li>
        </ol>
      </p>
    );
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Mes Centres de collecte | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <Stepper
            currentStep={3}
            // stepCount={4}
            stepCount={3}
            title="Vos Centres de Collecte"
            // nextTitle="Vos notifications"
          />
          <h1 className="fr-h2 fr-mb-2w">Identifier vos Centres de Collecte du Gibier sauvage</h1>
          <CallOut className="bg-white">
            <strong>Qu’est ce qu’un centre de collecte du gibier sauvage (CCG) ?</strong>
            <br />
            <br />
            C’est une chambre froide utilisée par les chasseurs pour déposer le gibier prélevé dans de bonnes
            conditions d’hygiène et de conservation avant sa cession.
          </CallOut>
          {/* <CallOut colorVariant="purple-glycine" className="bg-white">
            <strong>Qu’est ce qu’un centre de collecte du gibier sauvage (CCG) ?</strong>
            <br /> Si ce n'est pas encore fait, la démarche est simple et rapide,{' '}
            <a
              // href="https://entreprendre.service-public.fr/vosdroits/R44572"
              href="https://mesdemarches.agriculture.gouv.fr/demarches/association-ou-organisation-de/assurer-une-activite-de-76/article/declarer-la-manipulation-de"
              className="fr-link fr-link--icon-right text-lg"
            >
              disponible ici.
            </a>
          </CallOut> */}
          <div className="mb-6 bg-white md:shadow-sm" id="onboarding-etape-2-ccgs-data">
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
                          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
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
                        {entity.ccg_status === 'Pré-enregistré dans Zacharie' && (
                          <>
                            <RegisterCCG />
                            <p className="mt-4 text-sm">
                              Si vous avez déjà fait la démarche, vous pouvez ignorer ce message.
                            </p>
                          </>
                        )}
                      </>
                    }
                  />
                );
              })}
              <InputCCG addCCG={(ccg) => setUserCCGs([...userCCGs, ccg])} />
              <div className="mt-8">
                {!newCCGExpanded ? (
                  <>
                    Si vous utilisez un CCG non encore enregistré auprès des services de l’Etat, vous pouvez
                    l’identifier ici.
                    <br />
                    <Button
                      priority="secondary"
                      className="mt-4"
                      nativeButtonProps={{
                        onClick: () => setNewCCGExpanded(true),
                      }}
                    >
                      Pré-enregistrer mon CCG
                    </Button>
                  </>
                ) : (
                  <div className="rounded-lg border border-gray-300 px-8 py-6">
                    <p className="font-semibold">Pré-enregistrer un nouveau Centre de Collecte</p>
                    <p className="mb-5 text-sm text-gray-500">
                      * Les champs marqués d'une étoile sont obligatoires.
                    </p>
                    <form id="association_data_form" method="POST" onSubmit={handleNewCCGSubmit}>
                      <Input
                        label="Nom usuel *"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                          name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                          autoComplete: 'off',
                          required: true,
                          defaultValue: '',
                        }}
                      />
                      <Input
                        label="SIRET"
                        hintText="Si vous n'en n'avez pas, laissez vide."
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.siret,
                          name: Prisma.EntityScalarFieldEnum.siret,
                          autoComplete: 'off',
                          defaultValue: '',
                        }}
                      />
                      <Input
                        label="Numéro d'identification du CCG"
                        hintText="De la forme 03-CCG-123. Si vous ne le connaissez pas, laissez vide."
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                          name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                          autoComplete: 'off',
                          defaultValue: '',
                        }}
                      />
                      <Input
                        label="Adresse *"
                        hintText="Indication : numéro et voie"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.address_ligne_1,
                          name: Prisma.EntityScalarFieldEnum.address_ligne_1,
                          autoComplete: 'off',
                          required: true,
                          defaultValue: '',
                        }}
                      />
                      <Input
                        label="Complément d'adresse (optionnel)"
                        hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                        nativeInputProps={{
                          id: Prisma.EntityScalarFieldEnum.address_ligne_2,
                          name: Prisma.EntityScalarFieldEnum.address_ligne_2,
                          autoComplete: 'off',
                          defaultValue: '',
                        }}
                      />

                      <div className="flex w-full flex-col gap-x-4 md:flex-row">
                        <Input
                          label="Code postal *"
                          hintText="5 chiffres"
                          className="shrink-0 md:basis-1/5"
                          nativeInputProps={{
                            id: Prisma.EntityScalarFieldEnum.code_postal,
                            name: Prisma.EntityScalarFieldEnum.code_postal,
                            autoComplete: 'off',
                            required: true,
                            value: ccgPostalCode,
                            onChange: (e) => {
                              setCCGPostalCode(e.currentTarget.value);
                            },
                          }}
                        />
                        <div className="basis-4/5">
                          <InputVille
                            postCode={ccgPostalCode}
                            trimPostCode
                            label="Ville ou commune *"
                            hintText="Exemple : Montpellier"
                            nativeInputProps={{
                              id: Prisma.EntityScalarFieldEnum.ville,
                              name: Prisma.EntityScalarFieldEnum.ville,
                              autoComplete: 'off',
                              required: true,
                              defaultValue: '',
                            }}
                          />
                        </div>
                      </div>
                      <p className="my-4">
                        Ceci ne remplace pas la déclaration officielle du centre de collecte du gibier sauvage
                        (CCG). Cela permet simplement de pouvoir en faire référence dans Zacharie, en
                        attendant son enregistrement (voir ci-dessous).
                      </p>
                      <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                        Enregistrer
                      </Button>
                      <RegisterCCG />
                    </form>
                  </div>
                )}
              </div>
              <div className="mt-6 mb-16 ml-6">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                  Haut de page
                </a>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: 'Continuer',
                    linkProps: {
                      to: redirect || '/app/tableau-de-bord/mon-profil/mes-notifications',
                      // to: redirect || '/app/tableau-de-bord',
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
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
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
        label="Si vous utilisez un CCG enregistré auprès des services de l'Etat, renseignez ici son numéro d'identification."
        className="mb-0!"
        state={error ? 'error' : 'default'}
        stateRelatedMessage={error}
        nativeInputProps={{
          type: 'text',
          placeholder: 'Exemples : 03-CCG-123, ou encore 03.564.345',
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
