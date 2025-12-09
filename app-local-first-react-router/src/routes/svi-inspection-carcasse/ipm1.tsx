import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import {
  Prisma,
  CarcasseType,
  UserRoles,
  IPM1Protocole,
  IPM1Decision,
  Carcasse,
  Fei,
  PoidsType,
} from '@prisma/client';
import { lesionsList, lesionsTree } from '@app/utils/lesions';
import piecesList from '@app/data/svi/pieces-list.json';
import piecesTree from '@app/data/svi/pieces-tree.json';
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
import InputMultiSelect from '@app/components/InputMultiSelect';

const lesionsOuMotifsConsigneModal = createModal({
  isOpenedByDefault: false,
  id: 'observations-gors-gibier-modal',
});
const piecesGibier = createModal({
  isOpenedByDefault: false,
  id: 'pieces-gors-gibier-modal',
});

export function CarcasseIPM1({ canEdit = false }: { canEdit?: boolean }) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id!];

  const [sviIpm1PresenteeInspection, setSviIpm1PresenteeInspection] = useState(
    carcasse.svi_ipm1_presentee_inspection ?? true,
  );
  const [sviIpm1Date, setSviIpm1Date] = useState(carcasse.svi_ipm1_date);
  const [sviIpm1Protocole, setSviIpm1Protocole] = useState(
    carcasse.svi_ipm1_protocole ?? IPM1Protocole.STANDARD,
  );
  const [sviIpm1Pieces, setSviIpm1Pieces] = useState(carcasse.svi_ipm1_pieces);
  const [sviIpm1LesionsOuMotifs, setSviIpm1LesionsOuMotifs] = useState(carcasse.svi_ipm1_lesions_ou_motifs);
  const [sviIpm1NombreAnimaux, setSviIpm1NombreAnimaux] = useState(carcasse.svi_ipm1_nombre_animaux);
  const [sviIpm1Commentaire, setSviIpm1Commentaire] = useState(carcasse.svi_ipm1_commentaire);
  const [sviIpm1Decision, setSviIpm1Decision] = useState(
    carcasse.svi_ipm1_decision ?? IPM1Decision.MISE_EN_CONSIGNE,
  );
  const [sviIpm1DureeConsigne, setSviIpm1DureeConsigne] = useState(carcasse.svi_ipm1_duree_consigne);
  const [sviIpm1PoidsConsigne, setSviIpm1PoidsConsigne] = useState(carcasse.svi_ipm1_poids_consigne);
  const [sviIpm1PoidsType, setSviIpm1PoidsType] = useState(carcasse.svi_ipm1_poids_type);
  const [triedToSave, setTriedToSave] = useState(false);

  const missingFields = useMemo(() => {
    if (!sviIpm1Date) {
      return "Il manque la date de l'inspection";
    }
    if (!sviIpm1Protocole) {
      return "Il manque le protocole d'inspection";
    }
    if (!sviIpm1Decision) {
      return 'Il manque la décision IPM1';
    }
    if (sviIpm1PresenteeInspection && sviIpm1Decision === IPM1Decision.ACCEPTE) {
      return null;
    }
    if (!sviIpm1PresenteeInspection) {
      return null;
    }
    if (carcasse.type === CarcasseType.PETIT_GIBIER && !sviIpm1NombreAnimaux) {
      return "Il manque le nombre d'animaux inspectés";
    }
    if (!sviIpm1Pieces?.length) {
      return 'Il manque les pièces inspectées nécessitant une observation';
    }
    if (!sviIpm1LesionsOuMotifs?.length) {
      return 'Il manque les lésions';
    }
    if (sviIpm1Decision === IPM1Decision.MISE_EN_CONSIGNE && !sviIpm1DureeConsigne) {
      return 'Il manque la durée de la consigne';
    }
    return null;
  }, [
    sviIpm1Date,
    sviIpm1Protocole,
    sviIpm1Decision,
    sviIpm1PresenteeInspection,
    carcasse.type,
    sviIpm1NombreAnimaux,
    sviIpm1Pieces?.length,
    sviIpm1LesionsOuMotifs?.length,
    sviIpm1DureeConsigne,
  ]);

  function handleSave() {
    setTriedToSave(true);
    if (missingFields) {
      return;
    }
    console.log('SAVING IPM1');
    let newCarcasseCommentaire = '';
    if (sviIpm1Commentaire) {
      newCarcasseCommentaire += `IPM1\u00A0: ${sviIpm1Commentaire}`;
      if (carcasse.svi_ipm2_commentaire) {
        newCarcasseCommentaire += `\n\n`;
      }
    }
    if (carcasse.svi_ipm2_commentaire) {
      newCarcasseCommentaire += `IPM2\u00A0: ${carcasse.svi_ipm2_commentaire}`;
    }
    const partialCarcasse: Partial<Carcasse> = {
      svi_ipm1_presentee_inspection: sviIpm1PresenteeInspection,
      svi_ipm1_date: sviIpm1Date,
      svi_ipm1_protocole: sviIpm1Protocole,
      svi_ipm1_pieces: sviIpm1Pieces,
      svi_ipm1_lesions_ou_motifs: sviIpm1LesionsOuMotifs,
      svi_ipm1_nombre_animaux: sviIpm1NombreAnimaux,
      svi_ipm1_commentaire: sviIpm1Commentaire,
      svi_carcasse_commentaire: newCarcasseCommentaire,
      svi_ipm1_decision: sviIpm1Decision,
      svi_ipm1_user_id: carcasse.svi_ipm1_user_id ?? user.id,
      svi_ipm1_user_name_cache: carcasse.svi_ipm1_user_name_cache ?? `${user.prenom} ${user.nom_de_famille}`,
      svi_ipm1_duree_consigne: sviIpm1DureeConsigne,
      svi_ipm1_poids_consigne: sviIpm1PoidsConsigne,
      svi_ipm1_poids_type: sviIpm1PoidsType,
      svi_ipm1_signed_at: dayjs.utc().toDate(),
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
      action: 'svi-ipm1-edit',
      history: createHistoryInput(carcasse, partialCarcasse),
      entity_id: null,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    // TODO: vérifier qu'elles sont réellement bien enregistrées
    alert('IPM1 enregistrée');
  }

  const canDoIPM1 = useMemo(() => {
    if (!canEdit) {
      return false;
    }
    if (carcasse.svi_ipm1_signed_at) {
      return false;
    }
    return true;
  }, [canEdit, carcasse]);

  const Component = canDoIPM1 ? Input : InputNotEditable;

  return (
    <form method="POST" id={`svi-carcasse-${carcasse.numero_bracelet}`} onSubmit={(e) => e.preventDefault()}>
      <RadioButtons
        legend={
          carcasse.type === CarcasseType.PETIT_GIBIER
            ? "Lot présenté à l'inspection *"
            : "Carcasse présentée à l'inspection *"
        }
        orientation="horizontal"
        options={[
          {
            nativeInputProps: {
              required: true,
              checked: sviIpm1PresenteeInspection,
              onChange: () => {
                setSviIpm1PresenteeInspection(true);
                setSviIpm1Decision(IPM1Decision.MISE_EN_CONSIGNE);
              },
            },
            label: 'Oui',
          },
          {
            nativeInputProps: {
              required: true,
              checked: !sviIpm1PresenteeInspection,
              onChange: () => {
                setSviIpm1PresenteeInspection(false);
                setSviIpm1Decision(IPM1Decision.NON_RENSEIGNEE);
              },
            },
            label: 'Non, carcasse manquante',
          },
        ]}
      />
      <Component
        label="Date de l'inspection *"
        key={`${sviIpm1Date}`}
        hintText={
          canDoIPM1 ? (
            <button
              className="inline-block"
              type="button"
              onClick={() => {
                const date = dayjs.utc().startOf('day').toDate();
                setSviIpm1Date(date);
              }}
            >
              <u className="inline">Cliquez ici</u> pour définir la date du jour
            </button>
          ) : null
        }
        nativeInputProps={{
          id: Prisma.CarcasseScalarFieldEnum.svi_ipm1_date,
          name: Prisma.CarcasseScalarFieldEnum.svi_ipm1_date,
          type: 'date',
          autoComplete: 'off',
          required: true,
          suppressHydrationWarning: true,
          onBlur: (e) => {
            const date = dayjs.utc(e.target.value).startOf('day').toDate();
            setSviIpm1Date(date);
          },
          onChange: (e) => {
            const date = dayjs.utc(e.target.value).startOf('day').toDate();
            setSviIpm1Date(date);
          },
          value: sviIpm1Date ? dayjs(sviIpm1Date).format('YYYY-MM-DD') : '',
        }}
      />
      <InputNotEditable
        label="Inspection faite par *"
        nativeInputProps={{
          id: Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_id,
          name: Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_id,
          type: 'text',
          autoComplete: 'off',
          required: true,
          suppressHydrationWarning: true,
          defaultValue:
            carcasse.svi_ipm1_user_name_cache || sviIpm1Date
              ? `${user.prenom} ${user.nom_de_famille} (vous)`
              : '',
        }}
      />
      {sviIpm1PresenteeInspection && (
        <>
          <RadioButtons
            legend="Protocole d'inspection *"
            hintText="Le protocole d'inspection «Renforcé » est utilisé lorsqu’une analyse de risque locale le juge nécessaire (exemple : animal provenant de zone réglementée vis-à-vis d’une maladie animale)."
            orientation="horizontal"
            options={[
              {
                nativeInputProps: {
                  required: true,
                  checked: sviIpm1Protocole === IPM1Protocole.STANDARD,
                  onChange: () => {
                    setSviIpm1Protocole(IPM1Protocole.STANDARD);
                  },
                },
                label: 'Standard',
              },
              {
                nativeInputProps: {
                  required: true,
                  checked: sviIpm1Protocole === IPM1Protocole.RENFORCE,
                  onChange: () => {
                    setSviIpm1Protocole(IPM1Protocole.RENFORCE);
                  },
                },
                label: 'Renforcé',
              },
            ]}
          />
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <Input
              label="Nombre de carcasses consignées *"
              hintText={`Nombre d'animaux initialement prélevés\u00A0: ${carcasse.nombre_d_animaux}`}
              nativeInputProps={{
                type: 'number',
                min: 0,
                required: true,
                value: sviIpm1NombreAnimaux ?? '',
                // max: Number(carcasse.nombre_d_animaux),
                onChange: (e) => {
                  setSviIpm1NombreAnimaux(Number(e.target.value));
                },
              }}
            />
          )}
          <div>
            <InputMultiSelect
              label="Pièces inspectées nécessitant une observation *"
              hintText={
                <button type="button" onClick={() => piecesGibier.open()}>
                  Voir le référentiel des pièces en <u className="inline">cliquant ici</u>
                </button>
              }
              canEdit
              data={piecesList[carcasse.type ?? CarcasseType.GROS_GIBIER]}
              placeholder="Commencez à taper une pièce"
              onChange={setSviIpm1Pieces}
              values={sviIpm1Pieces}
              creatable
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
                const nextPieces = [...sviIpm1Pieces.filter((p) => p !== newPiece), newPiece];
                setSviIpm1Pieces(nextPieces);
              }}
            />
          </div>
          <div>
            <div className="mb-6 flex flex-row items-end gap-6">
              <div className="flex-1">
                <InputMultiSelect
                  data={lesionsList[carcasse.type ?? CarcasseType.GROS_GIBIER]}
                  label="Observations (lésions) *"
                  canEdit
                  placeholder="Commencez à taper une lésion"
                  onChange={setSviIpm1LesionsOuMotifs}
                  values={sviIpm1LesionsOuMotifs}
                />
              </div>
              <p className="mb-3 text-sm">ou</p>
              <div className="flex-1">
                <Button
                  type="button"
                  priority="tertiary no outline"
                  onClick={() => lesionsOuMotifsConsigneModal.open()}
                >
                  Filtrez par catégorie de lésion en&nbsp;<u className="inline">cliquant ici</u>
                </Button>
              </div>
            </div>
            <ModalTreeDisplay
              data={lesionsTree[carcasse.type ?? CarcasseType.GROS_GIBIER]}
              skipParent
              modal={lesionsOuMotifsConsigneModal}
              title={`Observations (lésions)`}
              onItemClick={(newLesionsOuMotifSaisie) => {
                const nextLesionsOuMotifsSaisie = [...sviIpm1LesionsOuMotifs, newLesionsOuMotifSaisie];
                setSviIpm1LesionsOuMotifs(nextLesionsOuMotifsSaisie);
              }}
            />
          </div>
        </>
      )}
      <Input
        label="Commentaire"
        hintText="Un commentaire à ajouter ?"
        textArea
        nativeTextAreaProps={{
          required: true,
          name: Prisma.CarcasseScalarFieldEnum.svi_ipm1_commentaire,
          form: `svi-carcasse-ipm1-${carcasse.numero_bracelet}`,
          value: sviIpm1Commentaire || '',
          onChange: (e) => {
            setSviIpm1Commentaire(e.target.value);
          },
        }}
      />
      {sviIpm1PresenteeInspection && (
        <RadioButtons
          legend="Décision IPM1 *"
          orientation="horizontal"
          options={[
            {
              nativeInputProps: {
                required: true,
                checked: sviIpm1Decision === IPM1Decision.MISE_EN_CONSIGNE,
                onChange: () => {
                  setSviIpm1Decision(IPM1Decision.MISE_EN_CONSIGNE);
                },
              },
              label: 'Mise en consigne',
            },
            {
              hintText: 'Aucune anomalie constatée',
              nativeInputProps: {
                required: true,
                checked: sviIpm1Decision === IPM1Decision.ACCEPTE,
                onChange: () => {
                  setSviIpm1Decision(IPM1Decision.ACCEPTE);
                },
              },
              label: 'Acceptée',
            },
          ]}
        />
      )}
      {sviIpm1Decision === IPM1Decision.MISE_EN_CONSIGNE && (
        <>
          <Input
            label="Durée de la consigne *"
            hintText="En heures"
            nativeInputProps={{
              type: 'number',
              required: true,
              min: 0,
              name: Prisma.CarcasseScalarFieldEnum.svi_ipm1_duree_consigne,
              form: `svi-carcasse-ipm1-${carcasse.numero_bracelet}`,
              value: sviIpm1DureeConsigne || '',
              onChange: (e) => {
                setSviIpm1DureeConsigne(Number(e.target.value));
              },
            }}
          />
          <Input
            label="Poids de la consigne"
            hintText="En kg, facultatif"
            nativeInputProps={{
              type: 'number',
              min: 0,
              name: Prisma.CarcasseScalarFieldEnum.svi_ipm1_poids_consigne,
              form: `svi-carcasse-ipm1-${carcasse.numero_bracelet}`,
              value: sviIpm1PoidsConsigne || '',
              onChange: (e) => {
                setSviIpm1PoidsConsigne(Number(e.target.value));
                if (!sviIpm1PoidsType) {
                  setSviIpm1PoidsType(PoidsType.DEPOUILLE);
                }
              },
            }}
          />
          {sviIpm1PoidsConsigne && sviIpm1PoidsConsigne > 0 && (
            <RadioButtons
              orientation="horizontal"
              options={[
                {
                  nativeInputProps: {
                    required: true,
                    checked: sviIpm1PoidsType === PoidsType.DEPOUILLE,
                    onChange: () => {
                      setSviIpm1PoidsType(PoidsType.DEPOUILLE);
                    },
                  },
                  label: 'Dépouillée/plumée',
                },
                {
                  nativeInputProps: {
                    required: true,
                    checked: sviIpm1PoidsType === PoidsType.NON_DEPOUILLE,
                    onChange: () => {
                      setSviIpm1PoidsType(PoidsType.NON_DEPOUILLE);
                    },
                  },
                  label: 'Non dépouillée/non plumée',
                },
              ]}
            />
          )}
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
