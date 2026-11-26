import { useState, useCallback, useRef, useEffect } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@app/components/Input';
import { EntityRelationType, Prisma, Entity } from '@prisma/client';
import InputCodePostalEtVille from '@app/components/InputCodePostalEtVille';
import type { UserEntityResponse } from '@api/src/types/responses';
import type { EntitiesById } from '@api/src/types/entity';
import SelectCustom from '@app/components/SelectCustom';
import API from '@app/services/api';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import useZustandStore from '@app/zustand/store';
import { toast } from 'react-toastify';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { searchEntreprises, type EtablissementTrouve } from '@app/services/recherche-entreprises';
import { track } from '@app/services/matomo';

interface PartenaireNouveauProps {
  defaultRaisonSociale?: string;
  onFinish: (entity: UserEntityResponse['data']['entity']) => void;
}
const ID_PREFIX = 'partenaire-nouveau';
const fieldId = (field: string) => `${ID_PREFIX}-${field}`;

const ANNUAIRE_OPTION_PREFIX = 'annuaire-';

type SelectOption = EntitiesById[string];

const QUALITES_PRESETS = [
  'Boucherie',
  'Restaurant',
  'Repas de chasse',
  'Repas associatif',
  'Cantine scolaire',
  'Collecteur professionnel',
  'Restauration collective',
];
const QUALITE_PRESET_CLASSNAME =
  'mr-1 mb-1 rounded-full bg-[#E8EDFF] px-3 py-1 text-left text-sm text-[#000091]';

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

export default function PartenaireNouveau({ defaultRaisonSociale, onFinish }: PartenaireNouveauProps) {
  const entities = useZustandStore((state) => state.entities);

  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | undefined>(
    defaultRaisonSociale || undefined
  );
  const [particulier, setParticulier] = useState(false);
  const [qualite, setQualite] = useState('');
  const [qualiteLibre, setQualiteLibre] = useState(false);
  const qualiteInputRef = useRef<HTMLInputElement>(null);
  const [annuairePrefill, setAnnuairePrefill] = useState<EtablissementTrouve | null>(null);

  const professionnel = !particulier;

  const newEntity = newEntityNomDUsage
    ? ({
        nom_d_usage: newEntityNomDUsage,
        id: 'nouvelle',
      } as SelectOption)
    : undefined;

  const prefillKey = annuairePrefill?.siret ?? 'vide';

  function selectAnnuaireEtablissement(etablissement: EtablissementTrouve) {
    setAnnuairePrefill(etablissement);
    setNewEntityNomDUsage(etablissement.raison_sociale);
  }

  function clearSelection() {
    setNewEntityNomDUsage('');
    setAnnuairePrefill(null);
  }

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

  const handleEntitySubmit = useCallback(
    async (event: React.FocusEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const body: Partial<Entity> & { particulier?: boolean } = Object.fromEntries(formData.entries());
      body.particulier = particulier;
      if (particulier) {
        body.raison_sociale =
          `${formData.get('prenom') ?? ''} ${formData.get('nom_de_famille') ?? ''}`.trim();
      } else {
        body.raison_sociale = newEntityNomDUsage?.trim();
        if (!body.raison_sociale) {
          alert('Veuillez renseigner la raison sociale');
          return;
        }
      }
      const response = await API.post({
        path: 'entite/partenaire',
        body,
      }).then((data) => data as UserEntityResponse);
      if (response.ok) {
        setParticulier(false);
        setQualite('');
        setQualiteLibre(false);
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
    [newEntityNomDUsage, particulier]
  );

  return (
    <>
      <form
        id="partenaire_data_form"
        method="POST"
        onSubmit={handleEntitySubmit}
      >
        <RadioButtons
          legend="Le destinataire est *"
          orientation="horizontal"
          options={[
            {
              nativeInputProps: {
                checked: !particulier,
                name: 'particulier',
                value: 'professionnel',
                onChange: () => setParticulier(false),
              },
              label: 'Un professionnel',
            },
            {
              nativeInputProps: {
                checked: particulier,
                name: 'particulier',
                value: 'particulier',
                onChange: () => setParticulier(true),
              },
              label: 'Un particulier',
            },
          ]}
        />
        {professionnel && (
          <div className="mb-6">
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
              hint={annuairePrefill?.siret ? undefined : "Recherchez l'entreprise par son nom"}
              name={Prisma.EntityScalarFieldEnum.raison_sociale}
              placeholder=""
              creatable={true}
              async={true}
              loadOptions={loadRaisonSocialeOptions}
              defaultOptions={annuaireInitial}
              isLoading={chargementAnnuaireInitial}
              defaultInputValue={defaultRaisonSociale}
              autoFocus={!!defaultRaisonSociale}
              openMenuOnFocus
              loadingMessage={() => "Recherche dans l'annuaire des entreprises..."}
              value={newEntity}
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
            />
            {annuairePrefill?.siret && (
              <p className="mt-2 mb-0 text-sm text-gray-600">SIRET : {annuairePrefill.siret}</p>
            )}
          </div>
        )}
        {professionnel && (
          <>
            <Input
              label="Qualité du destinataire *"
              hintText={
                !qualite && !qualiteLibre ? (
                  <>
                    {QUALITES_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={QUALITE_PRESET_CLASSNAME}
                        onClick={() => setQualite(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={QUALITE_PRESET_CLASSNAME}
                      onClick={() => {
                        setQualiteLibre(true);
                        qualiteInputRef.current?.focus();
                      }}
                    >
                      Autre
                    </button>
                  </>
                ) : undefined
              }
              nativeInputProps={{
                ref: qualiteInputRef,
                id: fieldId(Prisma.EntityScalarFieldEnum.qualite_du_destinataire),
                name: Prisma.EntityScalarFieldEnum.qualite_du_destinataire,
                placeholder: qualiteLibre
                  ? 'Entrez la qualité du destinataire (champ libre)'
                  : 'Entrez la qualité du destinataire ou sélectionnez ci-dessus',
                autoComplete: 'off',
                required: true,
                value: qualite,
                onChange: (e) => setQualite(e.target.value),
              }}
            />
            <input
              type="hidden"
              key={'SIRET' + prefillKey}
              name={Prisma.EntityScalarFieldEnum.siret}
              defaultValue={annuairePrefill?.siret ?? ''}
            />
          </>
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
            key={'Nom' + professionnel}
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
