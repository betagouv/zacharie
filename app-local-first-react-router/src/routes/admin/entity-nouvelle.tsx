import { useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, EntityTypes, type Entity } from '@prisma/client';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import type { AdminEntitiesResponse, AdminNewEntityResponse } from '@api/src/types/responses';
import InputCodePostalEtVille from '@app/components/InputCodePostalEtVille';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import { toast } from 'react-toastify';

// un destinataire n'a pas de compte Zacharie : on l'enregistre avec son représentant, qui reçoit
// une invitation. Le consommateur final n'est pas une entité, il n'est donc pas proposé ici.
const destinataireTypes: Array<EntityTypes> = [
  EntityTypes.COMMERCE_DE_DETAIL,
  EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
  EntityTypes.ASSOCIATION_CARITATIVE,
  EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
];

const NOUVELLE_ENTITE_ID = 'nouvelle';

export default function AdminNouvelleEntite() {
  const [isLoading, setIsLoading] = useState(false);
  const [entityType, setEntityType] = useState<EntityTypes | null>(null);
  const [existingEntities, setExistingEntities] = useState<Array<Entity>>([]);
  const [existingEntityId, setExistingEntityId] = useState<string | null>(null);
  const [nouvelleRaisonSociale, setNouvelleRaisonSociale] = useState('');
  const navigate = useNavigate();

  const isDestinataire = !!entityType && destinataireTypes.includes(entityType);
  const existingEntity = existingEntities.find((entity) => entity.id === existingEntityId);

  // les destinataires déjà enregistrés servent de suggestions : l'admin voit tout de suite
  // qu'une raison sociale existe plutôt que de créer un doublon
  useEffect(() => {
    if (!isDestinataire) {
      setExistingEntities([]);
      return;
    }
    API.get({ path: 'admin/entities', query: { type: entityType! } })
      .then((res) => res as AdminEntitiesResponse)
      .then((res) => {
        if (res.ok) setExistingEntities(res.data.entities);
      });
  }, [entityType, isDestinataire]);

  const selectOptions = nouvelleRaisonSociale
    ? [{ id: NOUVELLE_ENTITE_ID, nom_d_usage: nouvelleRaisonSociale } as Entity, ...existingEntities]
    : existingEntities;
  const selectValue = nouvelleRaisonSociale
    ? selectOptions.find((option) => option.id === NOUVELLE_ENTITE_ID)
    : existingEntity;

  const typeOption = (type: EntityTypes, label: string) => ({
    nativeInputProps: {
      required: true,
      name: Prisma.EntityScalarFieldEnum.type,
      value: type,
      checked: entityType === type,
      onChange: () => {
        setEntityType(type);
        setExistingEntityId(null);
        setNouvelleRaisonSociale('');
      },
    },
    label,
  });

  return (
    <form
      className="fr-container fr-container--fluid fr-my-md-14v"
      method="POST"
      onSubmit={async (event) => {
        event.preventDefault();
        setIsLoading(true);
        const formData = new FormData(event.target as HTMLFormElement);
        const body: Record<string, string> = Object.fromEntries(formData) as Record<string, string>;
        if (isDestinataire) {
          body[Prisma.EntityScalarFieldEnum.raison_sociale] = nouvelleRaisonSociale;
        }
        API.post({
          path: 'admin/entity/nouvelle',
          body,
        })
          .then((res) => res as AdminNewEntityResponse)
          .then((res) => {
            if (res.ok) {
              navigate(`/app/admin/entity/${res.data.entity.id}`);
            } else {
              toast.error(res.error || "Une erreur est survenue lors de la création de l'entité");
              setIsLoading(false);
            }
          });
      }}
    >
      <title>
        Nouvelle entité | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Nouvelle Entité</h1>
          <div className="mb-6 bg-white md:shadow-sm">
            <div className="p-4 pb-32 md:p-8 md:pb-0">
              <RadioButtons
                legend="Type d'entité"
                options={[
                  typeOption(
                    EntityTypes.PREMIER_DETENTEUR,
                    'Premier détenteur (association, domaine de chasse, etc.)'
                  ),
                  typeOption(EntityTypes.CCG, getUserRoleLabel(EntityTypes.CCG)),
                  typeOption(EntityTypes.COLLECTEUR_PRO, getUserRoleLabel(EntityTypes.COLLECTEUR_PRO)),
                  typeOption(EntityTypes.ETG, getUserRoleLabel(EntityTypes.ETG)),
                  typeOption(EntityTypes.SVI, getUserRoleLabel(EntityTypes.SVI)),
                  typeOption(
                    EntityTypes.COMMERCE_DE_DETAIL,
                    'Commerce de détail (boucherie, charcuterie, etc.)'
                  ),
                  typeOption(
                    EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
                    'Cantine ou restauration collective'
                  ),
                  typeOption(EntityTypes.ASSOCIATION_CARITATIVE, 'Association caritative'),
                  typeOption(EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF, 'Repas de chasse ou associatif'),
                ]}
              />
              {!isDestinataire && (
                <Input
                  label="Raison Sociale"
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.raison_sociale,
                    name: Prisma.EntityScalarFieldEnum.raison_sociale,
                    placeholder: 'ETG de la Garenne',
                    required: true,
                    autoComplete: 'off',
                  }}
                />
              )}
              {isDestinataire && (
                <>
                  <SelectCustom
                    options={selectOptions}
                    getOptionLabel={(entity) =>
                      entity.code_postal
                        ? `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`
                        : (entity.nom_d_usage ?? '')
                    }
                    getOptionValue={(entity) => entity.id}
                    creatable
                    label="Raison Sociale *"
                    placeholder=""
                    value={selectValue ?? null}
                    // @ts-expect-error - onCreateOption n'est pas typé
                    onCreateOption={(raisonSociale: string) => {
                      setNouvelleRaisonSociale(raisonSociale);
                      setExistingEntityId(null);
                    }}
                    onChange={(entity) => {
                      setNouvelleRaisonSociale('');
                      setExistingEntityId(entity?.id ?? null);
                    }}
                    isClearable
                    inputId={Prisma.EntityScalarFieldEnum.raison_sociale}
                    classNamePrefix={Prisma.EntityScalarFieldEnum.raison_sociale}
                    className="mb-6"
                  />
                  {existingEntity && (
                    <Alert
                      className="mb-8"
                      severity="warning"
                      title="Cette entité est déjà enregistrée dans Zacharie"
                      description={
                        <Button
                          size="small"
                          priority="secondary"
                          linkProps={{ to: `/app/admin/entity/${existingEntity.id}` }}
                        >
                          Ouvrir sa fiche
                        </Button>
                      }
                    />
                  )}
                </>
              )}
              {isDestinataire && !!nouvelleRaisonSociale && (
                <>
                  <Input
                    label="SIRET"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.siret,
                      name: Prisma.EntityScalarFieldEnum.siret,
                      autoComplete: 'off',
                    }}
                  />
                  <Input
                    label="Email du représentant *"
                    nativeInputProps={{
                      id: Prisma.UserScalarFieldEnum.email,
                      name: Prisma.UserScalarFieldEnum.email,
                      type: 'email',
                      autoComplete: 'off',
                      required: true,
                    }}
                  />
                  <div className="flex w-full flex-col gap-x-4 md:flex-row">
                    <Input
                      label="Nom du représentant *"
                      className="shrink-0 md:basis-1/2"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.nom_de_famille,
                        name: Prisma.UserScalarFieldEnum.nom_de_famille,
                        autoComplete: 'off',
                        required: true,
                      }}
                    />
                    <Input
                      label="Prénom du représentant *"
                      className="shrink-0 md:basis-1/2"
                      nativeInputProps={{
                        id: Prisma.UserScalarFieldEnum.prenom,
                        name: Prisma.UserScalarFieldEnum.prenom,
                        autoComplete: 'off',
                        required: true,
                      }}
                    />
                  </div>
                  <Input
                    label="Adresse *"
                    hintText="Indication : numéro et voie"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.address_ligne_1,
                      name: Prisma.EntityScalarFieldEnum.address_ligne_1,
                      autoComplete: 'off',
                      required: true,
                    }}
                  />
                  <Input
                    label="Complément d'adresse (optionnel)"
                    hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.address_ligne_2,
                      name: Prisma.EntityScalarFieldEnum.address_ligne_2,
                      autoComplete: 'off',
                    }}
                  />
                  <InputCodePostalEtVille required />
                </>
              )}
            </div>
            <div className="fixed bottom-16 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:bottom-0 md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: isLoading ? 'Création en cours...' : 'Créer',
                    disabled: isLoading || (isDestinataire && !nouvelleRaisonSociale),
                    type: 'submit',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
