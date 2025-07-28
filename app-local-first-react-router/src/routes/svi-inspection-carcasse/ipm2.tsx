import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import {
  Prisma,
  CarcasseType,
  UserRoles,
  IPM1Protocole,
  IPM2Decision,
  IPM2Traitement,
  Carcasse,
  Fei,
  IPM1Decision,
} from '@prisma/client';
import { lesionsList, lesionsTree } from '@app/utils/lesions';
import piecesTree from '@app/data/svi/pieces-tree.json';
import piecesList from '@app/data/svi/pieces-list.json';
import {
  etablissementsTree,
  retrieveEtablissementAgremenet,
} from '@app/utils/etablissementsTraitementSaintaire';
import dayjs from 'dayjs';
import InputNotEditable from '@app/components/InputNotEditable';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import ModalTreeDisplay from '@app/components/ModalTreeDisplay';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import Checkbox from '@codegouvfr/react-dsfr/Checkbox';
import InputMultiSelect from '@app/components/InputMultiSelect';

const lesionsOuMotifsConsigneModal = createModal({
  isOpenedByDefault: false,
  id: 'observations-ipm2-gors-gibier-modal',
});
const piecesGibier = createModal({
  isOpenedByDefault: false,
  id: 'pieces-ipm2-gors-gibier-modal',
});
const etablissementsTraitementSanitaireModal = createModal({
  isOpenedByDefault: false,
  id: 'etablissements-traitement-sanitaire-modal',
});

export function CarcasseIPM2({ canEdit = false }: { canEdit?: boolean }) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id!];

  const [sviIpm2PresenteeInspection, setSviIpm2PresenteeInspection] = useState(
    carcasse.svi_ipm2_presentee_inspection ?? true,
  );
  const [sviIpm2Date, setSviIpm2Date] = useState(carcasse.svi_ipm2_date);
  const [sviIpm2Protocole, setSviIpm2Protocole] = useState(
    carcasse.svi_ipm2_protocole ?? IPM1Protocole.STANDARD,
  );
  const [sviIpm2Pieces, setSviIpm2Pieces] = useState(
    carcasse.svi_ipm2_date ? carcasse.svi_ipm2_pieces : carcasse.svi_ipm1_pieces,
  );
  const [sviIpm2LesionsOuMotifs, setSviIpm2LesionsOuMotifs] = useState(
    carcasse.svi_ipm2_date ? carcasse.svi_ipm2_lesions_ou_motifs : carcasse.svi_ipm1_lesions_ou_motifs,
  );
  const [sviIpm2NombreAnimaux, setSviIpm2NombreAnimaux] = useState(
    carcasse.svi_ipm2_date ? carcasse.svi_ipm2_nombre_animaux : carcasse.svi_ipm1_nombre_animaux,
  );
  const [sviIpm2Commentaire, setSviIpm2Commentaire] = useState(carcasse.svi_ipm2_commentaire);
  const [sviIpm2Decision, setSviIpm2Decision] = useState(carcasse.svi_ipm2_decision);
  const [sviIpm2PoidsSaisie, setSviIpm2PoidsSaisie] = useState(
    carcasse.svi_ipm2_date ? carcasse.svi_ipm2_poids_saisie : carcasse.svi_ipm1_poids_consigne,
  );
  const [sviIpm2TraitementAssainissant, setSviIpm2TraitementAssainissant] = useState(
    carcasse.svi_ipm2_traitement_assainissant || [],
  );
  const [sviIpm2TraitementAssainissantCuissonTemps, setSviIpm2TraitementAssainissantCuissonTemps] = useState(
    carcasse.svi_ipm2_traitement_assainissant_cuisson_temps,
  );
  const [sviIpm2TraitementAssainissantCuissonTemp, setSviIpm2TraitementAssainissantCuissonTemp] = useState(
    carcasse.svi_ipm2_traitement_assainissant_cuisson_temp,
  );
  const [sviIpm2TraitementAssainissantCongelationTemps, setSviIpm2TraitementAssainissantCongelationTemps] =
    useState(carcasse.svi_ipm2_traitement_assainissant_congelation_temps);
  const [sviIpm2TraitementAssainissantCongelationTemp, setSviIpm2TraitementAssainissantCongelationTemp] =
    useState(carcasse.svi_ipm2_traitement_assainissant_congelation_temp);
  const [sviIpm2TraitementAssainissantType, setSviIpm2TraitementAssainissantType] = useState(
    carcasse.svi_ipm2_traitement_assainissant_type,
  );
  const [sviIpm2TraitementAssainissantParamètres, setSviIpm2TraitementAssainissantParamètres] = useState(
    carcasse.svi_ipm2_traitement_assainissant_paramètres,
  );
  const [sviIpm2TraitementAssainissantEtablissement, setSviIpm2TraitementAssainissantEtablissement] =
    useState(carcasse.svi_ipm2_traitement_assainissant_etablissement);
  const [sviIpm2TraitementAssainissantPoids, setSviIpm2TraitementAssainissantPoids] = useState(
    carcasse.svi_ipm2_traitement_assainissant_poids,
  );

  const [triedToSave, setTriedToSave] = useState(false);

  const missingFields = useMemo(() => {
    if (!sviIpm2Date) {
      return "Il manque la date de l'inspection";
    }
    if (!sviIpm2Protocole) {
      return "Il manque le protocole d'inspection";
    }
    if (!sviIpm2Decision) {
      return 'Il manque la décision IPM2';
    }
    if (sviIpm2PresenteeInspection) {
      if (carcasse.type === CarcasseType.PETIT_GIBIER && !sviIpm2NombreAnimaux) {
        return "Il manque le nombre d'animaux inspectés";
      }
      if (!sviIpm2Pieces?.length) {
        return 'Il manque les pièces inspectées nécessitant une observation';
      }
      if (sviIpm2Decision !== IPM2Decision.LEVEE_DE_LA_CONSIGNE) {
        if (!sviIpm2LesionsOuMotifs?.length) {
          return 'Il manque les lésions';
        }
      }
      if (sviIpm2Decision === IPM2Decision.TRAITEMENT_ASSAINISSANT) {
        if (!sviIpm2TraitementAssainissant?.length) {
          return 'Il manque le traitement assainissant';
        }
        if (sviIpm2TraitementAssainissant.includes(IPM2Traitement.CUISSON)) {
          if (!sviIpm2TraitementAssainissantCuissonTemps) {
            return 'Il manque le temps de cuisson';
          }
          if (!sviIpm2TraitementAssainissantCuissonTemp) {
            return 'Il manque la température de cuisson';
          }
        }
        if (sviIpm2TraitementAssainissant.includes(IPM2Traitement.CONGELATION)) {
          if (!sviIpm2TraitementAssainissantCongelationTemps) {
            return 'Il manque le temps de congélation';
          }
          if (!sviIpm2TraitementAssainissantCongelationTemp) {
            return 'Il manque la température de congélation';
          }
        }
        if (sviIpm2TraitementAssainissant.includes(IPM2Traitement.AUTRE)) {
          if (!sviIpm2TraitementAssainissantType) {
            return 'Il manque le type de traitement';
          }
          if (!sviIpm2TraitementAssainissantParamètres) {
            return 'Il manque les paramètres du traitement';
          }
        }
        if (!sviIpm2TraitementAssainissantEtablissement) {
          return "Il manque l'établissement";
        }
      }
    }
    return null;
  }, [
    sviIpm2Date,
    sviIpm2PresenteeInspection,
    sviIpm2Protocole,
    sviIpm2Pieces,
    sviIpm2LesionsOuMotifs,
    sviIpm2NombreAnimaux,
    sviIpm2Decision,
    sviIpm2TraitementAssainissant,
    sviIpm2TraitementAssainissantCuissonTemps,
    sviIpm2TraitementAssainissantCuissonTemp,
    sviIpm2TraitementAssainissantCongelationTemps,
    sviIpm2TraitementAssainissantCongelationTemp,
    sviIpm2TraitementAssainissantType,
    sviIpm2TraitementAssainissantParamètres,
    sviIpm2TraitementAssainissantEtablissement,
    carcasse.type,
  ]);

  function handleSave() {
    setTriedToSave(true);
    if (missingFields) {
      return;
    }
    const partialCarcasse: Partial<Carcasse> = {
      svi_ipm2_date: sviIpm2Date,
      svi_ipm2_presentee_inspection: sviIpm2PresenteeInspection,
      svi_ipm2_protocole: sviIpm2Protocole,
      svi_ipm2_pieces: sviIpm2Pieces,
      svi_ipm2_lesions_ou_motifs: sviIpm2LesionsOuMotifs,
      svi_ipm2_nombre_animaux: sviIpm2NombreAnimaux,
      svi_ipm2_commentaire: sviIpm2Commentaire,
      svi_carcasse_commentaire:
        sviIpm2Commentaire !== carcasse.svi_carcasse_commentaire
          ? carcasse.svi_carcasse_commentaire
            ? `${carcasse.svi_carcasse_commentaire}\n\nIPM2\u00A0: ${sviIpm2Commentaire}`
            : `IPM2\u00A0: ${sviIpm2Commentaire}`
          : carcasse.svi_carcasse_commentaire,
      svi_ipm2_decision: sviIpm2Decision,
      svi_ipm2_traitement_assainissant: sviIpm2TraitementAssainissant,
      svi_ipm2_traitement_assainissant_cuisson_temps: sviIpm2TraitementAssainissantCuissonTemps,
      svi_ipm2_traitement_assainissant_cuisson_temp: sviIpm2TraitementAssainissantCuissonTemp,
      svi_ipm2_traitement_assainissant_congelation_temps: sviIpm2TraitementAssainissantCongelationTemps,
      svi_ipm2_traitement_assainissant_congelation_temp: sviIpm2TraitementAssainissantCongelationTemp,
      svi_ipm2_traitement_assainissant_type: sviIpm2TraitementAssainissantType,
      svi_ipm2_traitement_assainissant_paramètres: sviIpm2TraitementAssainissantParamètres,
      svi_ipm2_traitement_assainissant_etablissement: sviIpm2TraitementAssainissantEtablissement,
      svi_ipm2_traitement_assainissant_poids: sviIpm2TraitementAssainissantPoids,
      svi_ipm2_poids_saisie: sviIpm2PoidsSaisie,
      svi_ipm2_user_id: carcasse.svi_ipm2_user_id ?? user.id,
      svi_ipm2_user_name_cache: carcasse.svi_ipm2_user_name_cache ?? `${user.prenom} ${user.nom_de_famille}`,
      svi_ipm2_signed_at: dayjs.utc().toDate(),
      svi_assigned_to_fei_at: carcasse.svi_assigned_to_fei_at ?? dayjs.utc().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, partialCarcasse, true);
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      const nextFei: Partial<Fei> = {
        fei_current_owner_role: UserRoles.SVI,
        fei_current_owner_entity_id: fei.fei_next_owner_entity_id,
        fei_current_owner_entity_name_cache: fei.fei_next_owner_entity_name_cache,
        fei_current_owner_user_id: user.id,
        fei_current_owner_user_name_cache:
          fei.fei_next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
        fei_next_owner_role: null,
        fei_next_owner_user_id: null,
        fei_next_owner_user_name_cache: null,
        fei_next_owner_entity_id: null,
        fei_next_owner_entity_name_cache: null,
        fei_prev_owner_role: fei.fei_current_owner_role || null,
        fei_prev_owner_user_id: fei.fei_current_owner_user_id || null,
        fei_prev_owner_entity_id: fei.fei_current_owner_entity_id || null,
        svi_user_id: user.id,
      };
      updateFei(fei.numero, nextFei);
    }
    addLog({
      user_id: user.id,
      user_role: UserRoles.SVI,
      fei_numero: fei.numero,
      action: 'svi-ipm2-edit',
      history: createHistoryInput(carcasse, partialCarcasse),
      entity_id: null,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    // TODO: vérifier qu'elles sont réellement bien enregistrées
    alert('IPM2 enregistrée');
  }

  const canDoIPM2 = useMemo(() => {
    if (!canEdit) {
      return false;
    }
    // if (carcasse.svi_ipm2_signed_at) {
    //   return false;
    // }
    if (carcasse.svi_ipm1_decision === IPM1Decision.ACCEPTE) {
      return false;
    }
    return true;
  }, [canEdit, carcasse.svi_ipm1_decision]);

  const Component = canDoIPM2 ? Input : InputNotEditable;

  return (
    <form method="POST" id={`svi-carcasse-${carcasse.numero_bracelet}`} onSubmit={(e) => e.preventDefault()}>
      {carcasse.svi_ipm1_decision === IPM1Decision.ACCEPTE && (
        <Alert
          severity="info"
          title="Vous ne pouvez pas modifier les données de l'inspection IPM2"
          description="L'inspection IPM1 a été acceptée, vous ne pouvez pas modifier les données de l'inspection IPM2.
          Veuillez changer la décision IPM1 pour modifier les données de l'inspection IPM2."
          className="mb-4 opacity-50"
        />
      )}
      <RadioButtons
        legend={
          carcasse.type === CarcasseType.PETIT_GIBIER
            ? "Lot présenté à l'inspection *"
            : "Carcasse présentée à l'inspection *"
        }
        orientation="horizontal"
        disabled={!canDoIPM2}
        options={[
          {
            nativeInputProps: {
              required: true,
              checked: sviIpm2PresenteeInspection,
              onChange: () => {
                setSviIpm2PresenteeInspection(true);
              },
            },
            label: 'Oui',
          },
          {
            nativeInputProps: {
              required: true,
              checked: !sviIpm2PresenteeInspection,
              onChange: () => {
                setSviIpm2PresenteeInspection(false);
              },
            },
            label: 'Non, carcasse manquante',
          },
        ]}
      />
      <Component
        label="Date de l'inspection *"
        disabled={!canDoIPM2}
        key={`${sviIpm2Date}`}
        hintText={
          canDoIPM2 ? (
            <button
              className="inline-block"
              type="button"
              onClick={() => {
                const date = dayjs.utc().startOf('day').toDate();
                setSviIpm2Date(date);
              }}
            >
              <u className="inline">Cliquez ici</u> pour définir la date du jour
            </button>
          ) : null
        }
        nativeInputProps={{
          id: Prisma.CarcasseScalarFieldEnum.svi_ipm2_date,
          name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_date,
          type: 'date',
          autoComplete: 'off',
          required: true,
          suppressHydrationWarning: true,
          disabled: !canDoIPM2,
          onBlur: (e) => {
            const date = dayjs.utc(e.target.value).startOf('day').toDate();
            setSviIpm2Date(date);
          },
          onChange: (e) => {
            const date = dayjs.utc(e.target.value).startOf('day').toDate();
            setSviIpm2Date(date);
          },
          value: sviIpm2Date ? dayjs(sviIpm2Date).format('YYYY-MM-DD') : '',
        }}
      />
      <InputNotEditable
        label="Inspection faite par *"
        disabled={!canDoIPM2}
        nativeInputProps={{
          id: Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_id,
          name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_id,
          type: 'text',
          autoComplete: 'off',
          required: true,
          suppressHydrationWarning: true,
          defaultValue:
            carcasse.svi_ipm2_user_name_cache || sviIpm2Date
              ? `${user.prenom} ${user.nom_de_famille} (vous)`
              : '',
        }}
      />
      {sviIpm2PresenteeInspection && (
        <>
          <RadioButtons
            legend="Protocole d'inspection *"
            hintText="Le protocole d'inspection «Renforcé » est utilisé lorsqu’une analyse de risque locale le juge nécessaire (exemple : animal provenant de zone réglementée vis-à-vis d’une maladie animale)."
            disabled={!canDoIPM2}
            orientation="horizontal"
            options={[
              {
                nativeInputProps: {
                  required: true,
                  checked: sviIpm2Protocole === IPM1Protocole.STANDARD,
                  onChange: () => {
                    setSviIpm2Protocole(IPM1Protocole.STANDARD);
                  },
                },
                label: 'Standard',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: sviIpm2Protocole === IPM1Protocole.RENFORCE,
                  onChange: () => {
                    setSviIpm2Protocole(IPM1Protocole.RENFORCE);
                  },
                },
                label: 'Renforcé',
              },
            ]}
          />
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <Input
              label="Nombre de carcasses saisies *"
              hintText={`Nombre d'animaux initialement prélevés\u00A0: ${carcasse.nombre_d_animaux}`}
              disabled={!canDoIPM2}
              nativeInputProps={{
                type: 'number',
                min: 0,
                required: true,
                value: sviIpm2NombreAnimaux ?? '',
                // max: Number(carcasse.nombre_d_animaux),
                onChange: (e) => {
                  setSviIpm2NombreAnimaux(Number(e.target.value));
                },
              }}
            />
          )}
          <div>
            <InputMultiSelect
              label="Pièces inspectées nécessitant une observation *"
              disabled={!canDoIPM2}
              canEdit
              hintText={
                <>
                  Rappel IPM1: {carcasse.svi_ipm1_pieces.join('; ')}
                  <br />
                  <button type="button" onClick={() => piecesGibier.open()}>
                    Voir le référentiel des pièces en <u className="inline">cliquant ici</u>
                  </button>
                </>
              }
              data={piecesList[carcasse.type ?? CarcasseType.GROS_GIBIER]}
              placeholder="Commencez à taper une pièce"
              onChange={setSviIpm2Pieces}
              values={sviIpm2Pieces}
            />
            <ModalTreeDisplay
              data={piecesTree[carcasse.type ?? CarcasseType.GROS_GIBIER]}
              modal={piecesGibier}
              title={
                carcasse.type === CarcasseType.PETIT_GIBIER
                  ? 'Pièces de petits gibiers'
                  : 'Pièces de grands gibiers'
              }
              onItemClick={(newPiece) => {
                const nextPieces = [...sviIpm2Pieces.filter((p) => p !== newPiece), newPiece];
                setSviIpm2Pieces(nextPieces);
              }}
            />
          </div>
          <div>
            <InputMultiSelect
              data={lesionsList[carcasse.type ?? CarcasseType.GROS_GIBIER]}
              label="Observations (lésions) *"
              disabled={!canDoIPM2}
              canEdit
              hintText={
                <>
                  Rappel IPM1: {carcasse.svi_ipm1_lesions_ou_motifs.join('; ')}
                  <br />
                  <button type="button" onClick={() => lesionsOuMotifsConsigneModal.open()}>
                    Voir le référentiel des lésions de carcasse en <u className="inline">cliquant ici</u>
                  </button>
                </>
              }
              placeholder={
                sviIpm2LesionsOuMotifs.length
                  ? 'Commencez à taper une lésion ou un motif de consigne supplémentaire'
                  : 'Commencez à taper une lésion ou un motif de consigne'
              }
              onChange={setSviIpm2LesionsOuMotifs}
              values={sviIpm2LesionsOuMotifs}
            />
            <ModalTreeDisplay
              data={lesionsTree[carcasse.type ?? CarcasseType.GROS_GIBIER]}
              skipParent
              modal={lesionsOuMotifsConsigneModal}
              title={`Lésions de carcasse ${carcasse.type === CarcasseType.GROS_GIBIER ? 'de grands gibier' : 'de petit gibier'}`}
              onItemClick={(newLesionsOuMotifSaisie) => {
                const nextLesionsOuMotifsSaisie = [...sviIpm2LesionsOuMotifs, newLesionsOuMotifSaisie];
                setSviIpm2LesionsOuMotifs(nextLesionsOuMotifsSaisie);
              }}
            />
          </div>
        </>
      )}
      <Input
        label="Commentaire"
        hintText="Un commentaire à ajouter ?"
        disabled={!canDoIPM2}
        textArea
        nativeTextAreaProps={{
          required: true,
          name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_commentaire,
          value: sviIpm2Commentaire || '',
          onChange: (e) => {
            setSviIpm2Commentaire(e.target.value);
          },
        }}
      />
      <RadioButtons
        legend="Décision IPM2 *"
        orientation="horizontal"
        disabled={!canDoIPM2}
        // @ts-expect-error Type 'null' is not assignable to type
        options={[
          !sviIpm2PresenteeInspection
            ? {
                nativeInputProps: {
                  className: 'non-renseigne',
                  required: true,
                  checked: sviIpm2Decision === IPM2Decision.NON_RENSEIGNEE,
                  onChange: () => {
                    setSviIpm2Decision(IPM2Decision.NON_RENSEIGNEE);
                  },
                },
                label: 'Non renseigné',
              }
            : null,
          {
            nativeInputProps: {
              required: true,
              checked: sviIpm2Decision === IPM2Decision.LEVEE_DE_LA_CONSIGNE,
              onChange: () => {
                setSviIpm2Decision(IPM2Decision.LEVEE_DE_LA_CONSIGNE);
              },
            },
            label: 'Levée de la consigne',
          },
          {
            nativeInputProps: {
              required: true,
              checked: sviIpm2Decision === IPM2Decision.SAISIE_PARTIELLE,
              onChange: () => {
                setSviIpm2Decision(IPM2Decision.SAISIE_PARTIELLE);
              },
            },
            label: 'Saisie partielle',
          },
          {
            nativeInputProps: {
              required: true,
              checked: sviIpm2Decision === IPM2Decision.SAISIE_TOTALE,
              onChange: () => {
                setSviIpm2Decision(IPM2Decision.SAISIE_TOTALE);
              },
            },
            label: 'Saisie totale',
          },
          {
            nativeInputProps: {
              required: true,
              checked: sviIpm2Decision === IPM2Decision.TRAITEMENT_ASSAINISSANT,
              onChange: () => {
                setSviIpm2Decision(IPM2Decision.TRAITEMENT_ASSAINISSANT);
              },
            },
            label: 'Traitement assainissant',
          },
        ].filter(Boolean)}
      />
      {sviIpm2Decision === IPM2Decision.TRAITEMENT_ASSAINISSANT && (
        <>
          <Checkbox
            legend="Type(s) de traitement(s) assainissant(s) *"
            orientation="horizontal"
            options={[
              {
                nativeInputProps: {
                  required: true,
                  checked: sviIpm2TraitementAssainissant.includes(IPM2Traitement.CUISSON),
                  onChange: () => {
                    if (sviIpm2TraitementAssainissant.includes(IPM2Traitement.CUISSON)) {
                      setSviIpm2TraitementAssainissant(
                        sviIpm2TraitementAssainissant.filter((t) => t !== IPM2Traitement.CUISSON),
                      );
                    } else {
                      setSviIpm2TraitementAssainissant([
                        ...sviIpm2TraitementAssainissant,
                        IPM2Traitement.CUISSON,
                      ]);
                    }
                  },
                },
                label: 'Cuisson',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: sviIpm2TraitementAssainissant.includes(IPM2Traitement.CONGELATION),
                  onChange: () => {
                    if (sviIpm2TraitementAssainissant.includes(IPM2Traitement.CONGELATION)) {
                      setSviIpm2TraitementAssainissant(
                        sviIpm2TraitementAssainissant.filter((t) => t !== IPM2Traitement.CONGELATION),
                      );
                    } else {
                      setSviIpm2TraitementAssainissant([
                        ...sviIpm2TraitementAssainissant,
                        IPM2Traitement.CONGELATION,
                      ]);
                    }
                  },
                },
                label: 'Congélation',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: sviIpm2TraitementAssainissant.includes(IPM2Traitement.AUTRE),
                  onChange: () => {
                    if (sviIpm2TraitementAssainissant.includes(IPM2Traitement.AUTRE)) {
                      setSviIpm2TraitementAssainissant(
                        sviIpm2TraitementAssainissant.filter((t) => t !== IPM2Traitement.AUTRE),
                      );
                    } else {
                      setSviIpm2TraitementAssainissant([
                        ...sviIpm2TraitementAssainissant,
                        IPM2Traitement.AUTRE,
                      ]);
                    }
                  },
                },
                label: 'Autre',
              },
            ]}
          />
          {sviIpm2TraitementAssainissant.includes(IPM2Traitement.CUISSON) && (
            <>
              <Input
                label="Temps de cuisson *"
                hintText="N'oubliez pas de définir l'unité de temps (min, h, jours, etc.)"
                nativeInputProps={{
                  name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temps,
                  value: sviIpm2TraitementAssainissantCuissonTemps || '',
                  onChange: (e) => {
                    setSviIpm2TraitementAssainissantCuissonTemps(e.target.value);
                  },
                }}
              />
              <Input
                label="Température de cuisson *"
                hintText="En °C"
                nativeInputProps={{
                  name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temp,
                  type: 'number',
                  min: -100,
                  max: 1000,
                  value: sviIpm2TraitementAssainissantCuissonTemp || '',
                  onChange: (e) => {
                    setSviIpm2TraitementAssainissantCuissonTemp(e.target.value);
                  },
                }}
              />
            </>
          )}
          {sviIpm2TraitementAssainissant.includes(IPM2Traitement.CONGELATION) && (
            <>
              <Input
                label="Temps de congélation *"
                hintText="N'oubliez pas de définir l'unité de temps (min, h, jours, etc.)"
                nativeInputProps={{
                  name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temps,
                  value: sviIpm2TraitementAssainissantCongelationTemps || '',
                  onChange: (e) => {
                    setSviIpm2TraitementAssainissantCongelationTemps(e.target.value);
                  },
                }}
              />
              <Input
                label="Température de congélation *"
                hintText="En °C"
                nativeInputProps={{
                  name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temp,
                  value: sviIpm2TraitementAssainissantCongelationTemp || '',
                  type: 'number',
                  min: -100,
                  max: 1000,
                  onChange: (e) => {
                    setSviIpm2TraitementAssainissantCongelationTemp(e.target.value);
                  },
                }}
              />
            </>
          )}
          {sviIpm2TraitementAssainissant.includes(IPM2Traitement.AUTRE) && (
            <>
              <Input
                label="Type de traitement *"
                nativeInputProps={{
                  name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_type,
                  value: sviIpm2TraitementAssainissantType || '',
                  onChange: (e) => {
                    setSviIpm2TraitementAssainissantType(e.target.value);
                  },
                }}
              />
              <Input
                label="Paramètre de traitement *"
                nativeInputProps={{
                  name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_paramètres,
                  value: sviIpm2TraitementAssainissantParamètres || '',
                  onChange: (e) => {
                    setSviIpm2TraitementAssainissantParamètres(e.target.value);
                  },
                }}
              />
            </>
          )}
          <Input
            label="N° d'agrément de l'établissement désigné pour réaliser le traitement assainissant *"
            hintText={
              <>
                <button type="button" onClick={() => etablissementsTraitementSanitaireModal.open()}>
                  Voir les établissements de traitement sanitaire en <u className="inline">cliquant ici.</u>
                </button>{' '}
                Source: section IV de la page{' '}
                <a href="https://agriculture.gouv.fr/liste-des-etablissements-agrees-ce-conformement-au-reglement-ce-ndeg8532004-lists-ue-approved">
                  Liste des établissements agréés CE conformément au règlement (CE) n°853/2004
                </a>
              </>
            }
            nativeInputProps={{
              name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_etablissement,
              value: sviIpm2TraitementAssainissantEtablissement || '',
              onChange: (e) => {
                setSviIpm2TraitementAssainissantEtablissement(e.target.value);
              },
            }}
          />
          <ModalTreeDisplay
            data={etablissementsTree}
            modal={etablissementsTraitementSanitaireModal}
            title="Etablissements de traitement sanitaire"
            onItemClick={(etablissementDisplay) => {
              setSviIpm2TraitementAssainissantEtablissement(
                retrieveEtablissementAgremenet(etablissementDisplay),
              );
            }}
          />
          <Input
            label="Poids des denrées devant faire l’objet d’un traitement assainissant"
            hintText="En kg, facultatif"
            nativeInputProps={{
              type: 'number',
              min: 0,
              name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_poids,
              value: sviIpm2TraitementAssainissantPoids || '',
              onChange: (e) => {
                setSviIpm2TraitementAssainissantPoids(Number(e.target.value));
              },
            }}
          />
        </>
      )}
      {(sviIpm2Decision === IPM2Decision.SAISIE_TOTALE ||
        sviIpm2Decision === IPM2Decision.SAISIE_PARTIELLE) && (
        <>
          <Input
            label="Poids de la saisie"
            hintText="En kg, facultatif"
            nativeInputProps={{
              type: 'number',
              min: 0,
              name: Prisma.CarcasseScalarFieldEnum.svi_ipm2_poids_saisie,
              value: sviIpm2PoidsSaisie || '',
              onChange: (e) => {
                setSviIpm2PoidsSaisie(Number(e.target.value));
              },
            }}
          />
        </>
      )}
      <div>
        <Button type="button" onClick={handleSave}>
          Enregistrer
        </Button>
      </div>
      {triedToSave && missingFields && (
        <Alert title="Attention" className="mt-4" severity="error" description={missingFields} />
      )}
    </form>
  );
}
