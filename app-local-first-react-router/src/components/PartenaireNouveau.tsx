import { useState, useCallback, useRef, useEffect } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@app/components/Input';
import { EntityRelationType, Prisma, Entity, EntityTypes } from '@prisma/client';
import InputCodePostalEtVille from '@app/components/InputCodePostalEtVille';
import type { UserEntityResponse } from '@api/src/types/responses';
import type { EntitiesById } from '@api/src/types/entity';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import useZustandStore from '@app/zustand/store';
import { toast } from 'react-toastify';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import {
  getEtablissementBySiret,
  isSiret,
  searchEntreprises,
  type EtablissementTrouve,
} from '@app/services/recherche-entreprises';
import { track } from '@app/services/matomo';

interface PartenaireNouveauProps {
  defaultRaisonSociale?: string;
  onFinish: (entity: UserEntityResponse['data']['entity']) => void;
}
// une même page peut afficher plusieurs formulaires d'entité : on préfixe les id des champs
// pour qu'ils restent uniques dans le document
const ID_PREFIX = 'partenaire-nouveau';
const fieldId = (field: string) => `${ID_PREFIX}-${field}`;

// les établissements venant de l'annuaire des entreprises ne sont pas des entités Zacharie :
// on les préfixe pour les reconnaître à la sélection
const ANNUAIRE_OPTION_PREFIX = 'annuaire-';

type SelectOption = EntitiesById[string];

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
  } as unknown as SelectOption;
}

function toAnnuaireGroups(etablissements: Array<EtablissementTrouve>) {
  if (!etablissements.length) return [];
  return [{ label: 'Annuaire des entreprises', options: etablissements.map(toAnnuaireOption) }];
}

// Le chasseur ne voit jamais les partenaires enregistrés par d'autres chasseurs : un commerce ne veut pas
// que ses concurrents sachent qu'il est livré via Zacharie. Il saisit toujours le partenaire en entier
// (aidé par l'annuaire des entreprises) et c'est le serveur qui le rattache à une fiche existante ou en crée une.
export default function PartenaireNouveau({ defaultRaisonSociale, onFinish }: PartenaireNouveauProps) {
  const entities = useZustandStore((state) => state.entities);

  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | undefined>(
    defaultRaisonSociale || undefined
  );
  const [entityType, setEntityType] = useState<EntityTypes | undefined>(undefined);
  const [annuairePrefill, setAnnuairePrefill] = useState<EtablissementTrouve | null>(null);

  const hasSiret = entityType !== EntityTypes.CONSOMMATEUR_FINAL;

  const newEntity = newEntityNomDUsage
    ? ({
        nom_d_usage: newEntityNomDUsage,
        id: 'nouvelle',
      } as SelectOption)
    : undefined;

  // les champs adresse/SIRET sont non contrôlés : on les remonte avec une clé
  // qui change à chaque nouveau préremplissage
  const prefillKey = annuairePrefill?.siret ?? 'vide';

  function selectAnnuaireEtablissement(etablissement: EtablissementTrouve) {
    setAnnuairePrefill(etablissement);
    setNewEntityNomDUsage(etablissement.raison_sociale);
  }

  function clearSelection() {
    setNewEntityNomDUsage('');
    setAnnuairePrefill(null);
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
    return toAnnuaireGroups(await searchAnnuaire(inputValue));
  }

  // la raison sociale arrive préremplie depuis la recherche de destinataire : on interroge l'annuaire
  // tout de suite, et le menu s'ouvre sur ses résultats
  const [annuaireInitial, setAnnuaireInitial] = useState<ReturnType<typeof toAnnuaireGroups>>();
  const [chargementAnnuaireInitial, setChargementAnnuaireInitial] = useState(!!defaultRaisonSociale);
  useEffect(() => {
    if (!defaultRaisonSociale) return;
    const controller = new AbortController();
    searchEntreprises(defaultRaisonSociale, controller.signal)
      .then((etablissements) => {
        if (controller.signal.aborted) return;
        setAnnuaireInitial(toAnnuaireGroups(etablissements));
        setChargementAnnuaireInitial(false);
      })
      .catch(() => setChargementAnnuaireInitial(false));
    return () => controller.abort();
  }, [defaultRaisonSociale]);

  function handleSiretBlur(siretSaisi: string) {
    if (!isSiret(siretSaisi)) return;
    const cleaned = siretSaisi.replace(/\s/g, '');
    if (annuairePrefill?.siret === cleaned) return;
    getEtablissementBySiret(cleaned).then((etablissement) => {
      if (!etablissement) return;
      selectAnnuaireEtablissement(etablissement);
    });
  }

  const handleEntitySubmit = useCallback(
    async (event: React.FocusEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const body: Partial<Entity> = Object.fromEntries(formData.entries());
      if (!entityType) {
        alert('Veuillez sélectionner un type de partenaire');
        return;
      }
      // le consommateur final n'a pas de raison sociale : on le nomme par le nom de son représentant
      if (entityType === EntityTypes.CONSOMMATEUR_FINAL) {
        body.raison_sociale =
          `${formData.get('prenom') ?? ''} ${formData.get('nom_de_famille') ?? ''}`.trim();
      } else {
        body.raison_sociale = newEntityNomDUsage?.trim();
        if (!body.raison_sociale) {
          alert('Veuillez renseigner la raison sociale');
          return;
        }
      }
      body.type = entityType;
      const response = await API.post({
        path: 'entite/partenaire',
        body,
      }).then((data) => data as UserEntityResponse);
      if (response.ok) {
        setEntityType(undefined);
        setAnnuairePrefill(null);
        track('partenaire', 'creer');
        onFinish(response.data.entity!);
        useZustandStore.setState({
          entities: {
            ...entities,
            [response.data.entity!.id]: {
              ...response.data.entity!,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
              relationStatus: undefined,
            },
          },
        });
      } else {
        toast.error(response.error || 'Une erreur est survenue lors de la création du partenaire');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newEntityNomDUsage, entityType]
  );

  return (
    <>
      <form
        id="partenaire_data_form"
        method="POST"
        onSubmit={handleEntitySubmit}
      >
        {hasSiret && (
          <SelectCustom
            getOptionLabel={(entity) => `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`}
            getOptionValue={(entity) => entity.id}
            formatOptionLabel={(entity, options) => {
              if (options.context === 'menu') {
                // @ts-expect-error - __isNew__ and value are not typed
                if (entity.__isNew__) return entity.value;
                if (!entity.code_postal) return entity.nom_d_usage;
                return `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`;
              }
              return entity.nom_d_usage;
            }}
            // @ts-expect-error - onCreateOption is not typed
            onCreateOption={async (raison_sociale) => {
              setNewEntityNomDUsage(raison_sociale);
              setAnnuairePrefill(null);
            }}
            label="Raison Sociale *"
            hint="Recherchez l'entreprise par son nom : le SIRET et l'adresse se remplissent automatiquement."
            name={Prisma.EntityScalarFieldEnum.raison_sociale}
            placeholder=""
            creatable={true}
            async={true}
            loadOptions={loadRaisonSocialeOptions}
            defaultOptions={annuaireInitial}
            isLoading={chargementAnnuaireInitial}
            // le nom est dans le champ de saisie (et non comme valeur choisie) pour que le curseur soit à la fin
            defaultInputValue={defaultRaisonSociale}
            autoFocus={!!defaultRaisonSociale}
            openMenuOnFocus
            loadingMessage={() => "Recherche dans l'annuaire des entreprises..."}
            value={newEntity}
            // la saisie devient la raison sociale au fil de la frappe : sur mobile, react-select quitte le
            // champ juste après le choix d'un résultat, un onBlur écraserait ce choix par le texte tapé
            onInputChange={(inputValue, { action }) => {
              if (action === 'input-change') setNewEntityNomDUsage(inputValue);
            }}
            onChange={(option) => {
              if (option?.id?.startsWith(ANNUAIRE_OPTION_PREFIX)) {
                selectAnnuaireEtablissement({
                  siret: option.siret!,
                  raison_sociale: option.nom_d_usage ?? '',
                  address_ligne_1: option.address_ligne_1 ?? '',
                  address_ligne_2: option.address_ligne_2 ?? '',
                  code_postal: option.code_postal ?? '',
                  ville: option.ville ?? '',
                });
                return;
              }
              if (!option) {
                clearSelection();
              }
            }}
            isClearable={!!newEntityNomDUsage}
            required={true}
            inputId={Prisma.EntityScalarFieldEnum.raison_sociale}
            classNamePrefix={Prisma.EntityScalarFieldEnum.raison_sociale}
            className="mb-6"
          />
        )}
        <RadioButtons
          legend="Qualité du destinataire *"
          hintText="Est-ce un commerce de détail, repas de chasse ou associatif, un consommateur final, ou encore un collecteur professionnel ?"
          orientation="vertical"
          options={[
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.COMMERCE_DE_DETAIL ? true : false,
                name: EntityTypes.COMMERCE_DE_DETAIL,
                onChange: () => {
                  setEntityType(EntityTypes.COMMERCE_DE_DETAIL);
                },
              },
              label: 'Commerce de détail (boucherie, restaurant, etc.)',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE ? true : false,
                name: EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
                onChange: () => {
                  setEntityType(EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE);
                },
              },
              label: 'Cantine ou restauration collective',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.ASSOCIATION_CARITATIVE ? true : false,
                name: EntityTypes.ASSOCIATION_CARITATIVE,
                onChange: () => {
                  setEntityType(EntityTypes.ASSOCIATION_CARITATIVE);
                },
              },
              label: 'Association caritative',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF ? true : false,
                name: EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
                onChange: () => {
                  setEntityType(EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF);
                },
              },
              label: 'Repas de chasse ou associatif',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.CONSOMMATEUR_FINAL ? true : false,
                name: EntityTypes.CONSOMMATEUR_FINAL,
                onChange: () => {
                  setEntityType(EntityTypes.CONSOMMATEUR_FINAL);
                },
              },
              label: 'Consommateur final',
            },
            {
              nativeInputProps: {
                checked: entityType === EntityTypes.COLLECTEUR_PRO ? true : false,
                name: EntityTypes.COLLECTEUR_PRO,
                onChange: () => {
                  setEntityType(EntityTypes.COLLECTEUR_PRO);
                },
              },
              label: 'Collecteur professionnel',
            },
          ]}
        />
        {hasSiret && (
          <Input
            label="SIRET"
            hintText="14 chiffres : la raison sociale et l'adresse se remplissent automatiquement."
            key={'SIRET' + prefillKey}
            nativeInputProps={{
              id: fieldId(Prisma.EntityScalarFieldEnum.siret),
              name: Prisma.EntityScalarFieldEnum.siret,
              autoComplete: 'off',
              defaultValue: annuairePrefill?.siret ?? '',
              onBlur: (event) => handleSiretBlur(event.target.value),
            }}
          />
        )}
        <Input
          label="Email du représentant *"
          nativeInputProps={{
            id: fieldId(Prisma.UserScalarFieldEnum.email),
            name: Prisma.UserScalarFieldEnum.email,
            autoComplete: 'off',
            required: true,
          }}
        />
        <div className="flex w-full flex-col gap-x-4 md:flex-row">
          <Input
            label="Nom du représentant *"
            className="shrink-0 md:basis-1/2"
            key={'Nom' + hasSiret}
            nativeInputProps={{
              id: fieldId(Prisma.UserScalarFieldEnum.nom_de_famille),
              name: Prisma.UserScalarFieldEnum.nom_de_famille,
              autoComplete: 'off',
              required: true,
            }}
          />
          <Input
            label="Prénom du représentant *"
            className="shrink-0 md:basis-1/2"
            nativeInputProps={{
              id: fieldId(Prisma.UserScalarFieldEnum.prenom),
              name: Prisma.UserScalarFieldEnum.prenom,
              autoComplete: 'off',
              required: true,
            }}
          />
        </div>
        <Input
          label="Adresse *"
          key={'Adresse *' + prefillKey}
          hintText="Indication : numéro et voie"
          nativeInputProps={{
            id: fieldId(Prisma.EntityScalarFieldEnum.address_ligne_1),
            name: Prisma.EntityScalarFieldEnum.address_ligne_1,
            autoComplete: 'off',
            required: true,
            defaultValue: annuairePrefill?.address_ligne_1 ?? '',
          }}
        />
        <Input
          label="Complément d'adresse (optionnel)"
          hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
          key={"Complément d'adresse (optionnel)" + prefillKey}
          nativeInputProps={{
            id: fieldId(Prisma.EntityScalarFieldEnum.address_ligne_2),
            name: Prisma.EntityScalarFieldEnum.address_ligne_2,
            autoComplete: 'off',
            defaultValue: annuairePrefill?.address_ligne_2 ?? '',
          }}
        />

        <InputCodePostalEtVille
          key={prefillKey}
          idPrefix={ID_PREFIX}
          required
          defaultCodePostal={annuairePrefill?.code_postal ?? ''}
          defaultVille={annuairePrefill?.ville ?? ''}
        />
        <Alert
          closable
          className="mb-6 bg-white"
          small
          severity="info"
          description="Attention : les établissements de traitement du gibier et la plupart des collecteurs professionnels sont déjà enregistrés sur Zacharie, choisissez-les dans la liste. Ce formulaire sert à enregistrer les autres destinataires (collecteurs professionnels absents de la liste, commerces de détail, associations, particuliers…)."
        />
        <Button
          type="submit"
          nativeButtonProps={{ form: 'partenaire_data_form' }}
        >
          Enregistrer
        </Button>
      </form>
    </>
  );
}
