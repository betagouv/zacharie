import { useState, useCallback, useEffect } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { EntityTypes, EntityRelationType, Prisma, Entity } from '@prisma/client';
import InputVille from '@app/components/InputVille';
import type { UserConnexionResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import type { UserCCGsResponse, UserEntityResponse } from '@api/src/types/responses';

export default function MesCCGs() {
  const [userCCGs, setUserCCGs] = useState<Array<Entity>>([]);
  const user = useUser((state) => state.user)!;

  // Add this handler for CCG radio buttons
  const handleUserSubmit = useCallback(
    async (checked_has_ccg: boolean) => {
      const body: Record<string, string | null> = {};
      body.checked_has_ccg = checked_has_ccg ? 'true' : 'false';
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

  function refreshUserCCGs() {
    API.get({ path: 'user/my-ccgs' })
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

  const [explicitelySaidNoCCG, setExplicitelySaidNoCCG] = useState(false);
  const [newCCGExpanded, setNewCCGExpanded] = useState(false);
  const [registerOneMoreCCG, setRegisterOneMoreCCG] = useState(false);
  const [ccgPostalCode, setCCGPostalCode] = useState('');
  const handleNewCCGSubmit = useCallback(async (event: React.FocusEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body: Partial<Entity> = Object.fromEntries(formData.entries());
    const response = await API.post({
      path: 'entite/ccg',
      body,
    }).then((response) => response as UserConnexionResponse);
    if (response.ok) {
      refreshUserCCGs();
      setCCGPostalCode('');
      setNewCCGExpanded(false);
      setRegisterOneMoreCCG(false);
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
        Pour déclarer l’activité du CCG, il vous suffit de cliquer{' '}
        <a
          href="https://scribehow.com/shared/Declarer_un_centre_de_collecte_de_gibier_CCG__f9XrNsQYQx68Mk-WDBJr0w"
          target="_blank"
          rel="noreferrer noopener"
        >
          ici
        </a>{' '}
        pour accéder à notre tutoriel.
      </p>
    );
  }

  return (
    <div className="mb-6 bg-white md:shadow-sm" id="onboarding-etape-2-ccgs-data">
      <div className="p-4 md:p-8">
        <h3 className="inline-flex items-center text-lg font-semibold text-gray-900">
          <span>Chambres froides (Centres de Collecte du Gibier sauvage)</span>
        </h3>
        {!userCCGs.length && (
          <RadioButtons
            legend="Utilisez-vous une ou plusieurs chambres froides pour entreposer votre gibier avant son transport ?"
            hintText="Une chambre froide est aussi appelée Centre de Collecte du Gibier sauvage (CCG)."
            orientation="vertical"
            options={[
              {
                nativeInputProps: {
                  required: true,
                  checked: !!user.checked_has_ccg && !newCCGExpanded,
                  name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                  onClick: () => {
                    handleUserSubmit(true);
                    setNewCCGExpanded(false);
                    setRegisterOneMoreCCG(true);
                    setExplicitelySaidNoCCG(false);
                  },
                },
                label: 'Oui et la chambre froide a un numéro d’identification',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: !!user.checked_has_ccg && newCCGExpanded,
                  name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                  onClick: () => {
                    handleUserSubmit(true);
                    setNewCCGExpanded(true);
                    setRegisterOneMoreCCG(true);
                    setExplicitelySaidNoCCG(false);
                  },
                },
                label: 'Oui mais la chambre froide n’a pas de numéro d’identification',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: explicitelySaidNoCCG,
                  name: 'not_checked_has_ccg',
                  onClick: () => {
                    handleUserSubmit(false);
                    setNewCCGExpanded(false);
                    setRegisterOneMoreCCG(false);
                    setExplicitelySaidNoCCG(true);
                  },
                },
                label: 'Non, je n’utilise pas de chambre froide',
              },
            ]}
          />
        )}

        {/* Only show CCG list and add buttons if user has CCGs or checked_has_ccg is true */}
        {(userCCGs.length > 0 || user.checked_has_ccg) && (
          <>
            {userCCGs.map((entity) => {
              return (
                <Notice
                  key={entity.id}
                  className="fr-text-default--grey fr-background-contrast--grey mb-4 [&_p.fr-notice__title]:before:hidden"
                  style={{
                    boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
                  }}
                  isClosable
                  onClose={() => {
                    API.post({
                      path: `/user/user-entity/${user.id}`,
                      body: {
                        _action: 'delete',
                        [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                        [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
                      },
                    }).then((res) => {
                      if (res.ok) {
                        const nextCCGs = userCCGs.filter((ccg) => ccg.id !== entity.id);
                        if (nextCCGs.length === 0) {
                          handleUserSubmit(false);
                          setNewCCGExpanded(false);
                          setRegisterOneMoreCCG(false);
                        }
                        setUserCCGs(nextCCGs);
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
            <div className="mt-8">
              {!registerOneMoreCCG && userCCGs?.length > 0 && (
                <Button
                  type="button"
                  priority="primary"
                  className="mt-4"
                  nativeButtonProps={{
                    onClick: () => setRegisterOneMoreCCG(true),
                  }}
                >
                  Ajouter une chambre froide
                </Button>
              )}
              {!!registerOneMoreCCG && userCCGs?.length > 0 && (
                <RadioButtons
                  legend=""
                  hintText=""
                  orientation="vertical"
                  options={[
                    {
                      nativeInputProps: {
                        required: true,
                        checked: !!user.checked_has_ccg && !newCCGExpanded,
                        name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                        onClick: () => {
                          setNewCCGExpanded(false);
                        },
                      },
                      label: 'Ma chambre froide a un numéro d’identification',
                    },
                    {
                      nativeInputProps: {
                        required: true,
                        checked: !!user.checked_has_ccg && newCCGExpanded,
                        name: Prisma.UserScalarFieldEnum.checked_has_ccg,
                        onClick: () => {
                          setNewCCGExpanded(true);
                        },
                      },
                      label: 'Ma chambre froide n’a pas de numéro d’identification',
                    },
                  ]}
                />
              )}
              {!newCCGExpanded && !!registerOneMoreCCG && (
                <InputCCG
                  key={userCCGs.length}
                  addCCG={(ccg) => {
                    setUserCCGs([...userCCGs, ccg]);
                    setRegisterOneMoreCCG(false);
                  }}
                />
              )}
              {!!newCCGExpanded && !!registerOneMoreCCG && (
                <div className="rounded-lg border border-gray-300 px-8 py-6">
                  <p className="font-semibold">Pré-enregistrer une nouvelle chambre froide (CCG)</p>
                  <p className="mb-5 text-sm text-gray-500">
                    * Les champs marqués d'un astérisque (*) sont obligatoires.
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
                    {/* <Input
                      label="Numéro d'identification du CCG"
                      hintText="De la forme 03-CCG-123, ou encore 03.564.345. Si vous ne le connaissez pas, laissez vide."
                      nativeInputProps={{
                        id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
                        autoComplete: 'off',
                        defaultValue: '',
                      }}
                    /> */}
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
                      Ceci ne remplace pas la déclaration officielle du CCG. Cela permet simplement de pouvoir
                      en faire référence dans Zacharie, en attendant son enregistrement (voir ci-dessous).
                    </p>
                    <Button type="submit" nativeButtonProps={{ form: 'association_data_form' }}>
                      Enregistrer ma chambre froide (CCG)
                    </Button>
                    <RegisterCCG />
                  </form>
                  <Button
                    type="button"
                    priority="tertiary no outline"
                    className="mt-4"
                    nativeButtonProps={{
                      onClick: () => {
                        setNewCCGExpanded(false);
                        handleUserSubmit(false);
                        setRegisterOneMoreCCG(false);
                        setTimeout(() => {
                          document
                            .getElementById('onboarding-etape-2-ccgs-data')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      },
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
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
      className="w-full gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        API.post({
          path: `/user/user-entity/${user.id}`,
          body: {
            _action: 'create',
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            [Prisma.EntityScalarFieldEnum.numero_ddecpp]: formData.get(
              Prisma.EntityScalarFieldEnum.numero_ddecpp,
            ),
            [Prisma.EntityScalarFieldEnum.type]: EntityTypes.CCG,
          },
        })
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
        label="Numéro d'identification"
        state={error ? 'error' : 'default'}
        stateRelatedMessage={error}
        nativeInputProps={{
          type: 'text',
          placeholder: 'Exemples : 03-CCG-123, ou encore 03.564.345',
          id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
          required: true,
          name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
        }}
      />
      <Button type="submit" disabled={isSubmitting}>
        {!isSubmitting ? 'Ajouter cette chambre froide' : 'Recherche en cours...'}
      </Button>
    </form>
  );
}
