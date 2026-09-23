import { useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
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
import {
  getEtablissementBySiret,
  isSiret,
  searchEntreprises,
  type EtablissementTrouve,
} from '@app/services/recherche-entreprises';

// un destinataire n'a pas de compte Zacharie : on l'enregistre avec son représentant, qui reçoit
// une invitation. Le consommateur final n'est pas une entité, il n'est donc pas proposé ici.
const destinataireTypes: Array<EntityTypes> = [
  EntityTypes.COMMERCE_DE_DETAIL,
  EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
  EntityTypes.ASSOCIATION_CARITATIVE,
  EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
];

const NOUVELLE_ENTITE_ID = 'nouvelle';
// les établissements venant de l'annuaire des entreprises ne sont pas des entités Zacharie :
// on les préfixe pour les reconnaître à la sélection
const ANNUAIRE_OPTION_PREFIX = 'annuaire-';
const EXISTING_GROUP_LABEL = 'Déjà dans Zacharie';

function toAnnuaireOption(etablissement: EtablissementTrouve) {
  return {
    id: `${ANNUAIRE_OPTION_PREFIX}${etablissement.siret}`,
    nom_d_usage: etablissement.raison_sociale,
    raison_sociale: etablissement.raison_sociale,
    siret: etablissement.siret,
    address_ligne_1: etablissement.address_ligne_1,
    address_ligne_2: etablissement.address_ligne_2,
    code_postal: etablissement.code_postal,
    ville: etablissement.ville,
  } as Entity;
}

export default function AdminNouvelleEntite() {
  const [isLoading, setIsLoading] = useState(false);
  const [entityType, setEntityType] = useState<EntityTypes | null>(null);
  const [existingEntities, setExistingEntities] = useState<Array<Entity>>([]);
  const [existingEntityId, setExistingEntityId] = useState<string | null>(null);
  const [nouvelleRaisonSociale, setNouvelleRaisonSociale] = useState('');
  const [annuairePrefill, setAnnuairePrefill] = useState<EtablissementTrouve | null>(null);
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

  const selectValue = nouvelleRaisonSociale
    ? ({
        id: NOUVELLE_ENTITE_ID,
        nom_d_usage: nouvelleRaisonSociale,
        code_postal: annuairePrefill?.code_postal ?? null,
        ville: annuairePrefill?.ville ?? null,
      } as Entity)
    : existingEntity;

  // les champs adresse/SIRET sont non contrôlés : on les remonte avec une clé
  // qui change à chaque nouveau préremplissage
  const prefillKey = annuairePrefill?.siret ?? 'vide';

  function selectAnnuaireEtablissement(etablissement: EtablissementTrouve) {
    // un établissement déjà enregistré est signalé plutôt que dupliqué
    const existing = existingEntities.find((entity) => entity.siret === etablissement.siret);
    if (existing) {
      setNouvelleRaisonSociale('');
      setAnnuairePrefill(null);
      setExistingEntityId(existing.id);
      return;
    }
    setExistingEntityId(null);
    setAnnuairePrefill(etablissement);
    setNouvelleRaisonSociale(etablissement.raison_sociale);
  }

  // l'annuaire est interrogé à chaque frappe : on attend 300 ms de pause avant l'appel réseau,
  // et on annule la requête précédente pour qu'une réponse lente n'écrase pas la plus récente
  const annuaireTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annuaireAbort = useRef<AbortController | null>(null);
  function searchAnnuaire(inputValue: string): Promise<Array<EtablissementTrouve>> {
    return new Promise((resolve) => {
      if (annuaireTimeout.current) clearTimeout(annuaireTimeout.current);
      annuaireAbort.current?.abort();
      const controller = new AbortController();
      annuaireAbort.current = controller;
      controller.signal.addEventListener('abort', () => resolve([]));
      annuaireTimeout.current = setTimeout(() => {
        searchEntreprises(inputValue, controller.signal).then(resolve);
      }, 300);
    });
  }

  async function loadRaisonSocialeOptions(inputValue: string) {
    const search = inputValue.trim().toLowerCase();
    const existing = existingEntities.filter((entity) =>
      [entity.nom_d_usage, entity.raison_sociale, entity.siret].some((value) =>
        value?.toLowerCase().includes(search)
      )
    );
    const etablissements = await searchAnnuaire(inputValue);
    const groups = [];
    if (existing.length) groups.push({ label: EXISTING_GROUP_LABEL, options: existing });
    if (etablissements.length) {
      groups.push({ label: 'Annuaire des entreprises', options: etablissements.map(toAnnuaireOption) });
    }
    return groups;
  }

  function handleSiretBlur(siretSaisi: string) {
    if (!isSiret(siretSaisi)) return;
    const cleaned = siretSaisi.replace(/\s/g, '');
    if (annuairePrefill?.siret === cleaned) return;
    getEtablissementBySiret(cleaned).then((etablissement) => {
      if (!etablissement) return;
      selectAnnuaireEtablissement(etablissement);
    });
  }

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
        setAnnuairePrefill(null);
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
        body[Prisma.EntityScalarFieldEnum.raison_sociale] = nouvelleRaisonSociale;
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
              <SelectCustom
                key={entityType ?? 'aucun'}
                async
                loadOptions={loadRaisonSocialeOptions}
                defaultOptions={
                  existingEntities.length ? [{ label: EXISTING_GROUP_LABEL, options: existingEntities }] : []
                }
                loadingMessage={() => "Recherche dans l'annuaire des entreprises..."}
                getOptionLabel={(entity) =>
                  entity.code_postal
                    ? `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`
                    : (entity.nom_d_usage ?? '')
                }
                getOptionValue={(entity) => entity.id}
                creatable
                label="Raison Sociale *"
                hint="Recherchez l'entreprise par son nom : le SIRET et l'adresse se remplissent automatiquement."
                placeholder=""
                value={selectValue ?? null}
                // @ts-expect-error - onCreateOption n'est pas typé
                onCreateOption={(raisonSociale: string) => {
                  setNouvelleRaisonSociale(raisonSociale);
                  setExistingEntityId(null);
                  setAnnuairePrefill(null);
                }}
                // une raison sociale saisie sans valider avec Entrée est gardée à la sortie du champ
                onBlur={(event) => {
                  if (!event.target.value) return;
                  setNouvelleRaisonSociale(event.target.value);
                  setExistingEntityId(null);
                  setAnnuairePrefill(null);
                }}
                onChange={(entity) => {
                  if (entity?.id.startsWith(ANNUAIRE_OPTION_PREFIX)) {
                    selectAnnuaireEtablissement({
                      siret: entity.siret!,
                      raison_sociale: entity.nom_d_usage ?? '',
                      address_ligne_1: entity.address_ligne_1 ?? '',
                      address_ligne_2: entity.address_ligne_2 ?? '',
                      code_postal: entity.code_postal ?? '',
                      ville: entity.ville ?? '',
                    });
                    return;
                  }
                  setNouvelleRaisonSociale('');
                  setAnnuairePrefill(null);
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
              {isDestinataire && !!nouvelleRaisonSociale && (
                <>
                  <Input
                    label="SIRET"
                    hintText="14 chiffres : la raison sociale et l'adresse se remplissent automatiquement."
                    key={'SIRET' + prefillKey}
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.siret,
                      name: Prisma.EntityScalarFieldEnum.siret,
                      autoComplete: 'off',
                      defaultValue: annuairePrefill?.siret ?? '',
                      onBlur: (event) => handleSiretBlur(event.target.value),
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
                    key={'Adresse' + prefillKey}
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.address_ligne_1,
                      name: Prisma.EntityScalarFieldEnum.address_ligne_1,
                      autoComplete: 'off',
                      required: true,
                      defaultValue: annuairePrefill?.address_ligne_1 ?? '',
                    }}
                  />
                  <Input
                    label="Complément d'adresse (optionnel)"
                    hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
                    key={'Complément' + prefillKey}
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.address_ligne_2,
                      name: Prisma.EntityScalarFieldEnum.address_ligne_2,
                      autoComplete: 'off',
                      defaultValue: annuairePrefill?.address_ligne_2 ?? '',
                    }}
                  />
                  <InputCodePostalEtVille
                    key={prefillKey}
                    required
                    defaultCodePostal={annuairePrefill?.code_postal ?? ''}
                    defaultVille={annuairePrefill?.ville ?? ''}
                  />
                </>
              )}
            </div>
            <div className="fixed bottom-16 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:bottom-0 md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: isLoading ? 'Création en cours...' : 'Créer',
                    disabled: isLoading || !nouvelleRaisonSociale,
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
