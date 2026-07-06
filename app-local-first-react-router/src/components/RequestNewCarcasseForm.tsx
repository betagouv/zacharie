import { useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import {
  Carcasse,
  CarcasseType,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
  CarcasseModificationRequest,
} from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import useUser from '@app/zustand/user';
import type { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import { CarcasseTransmission } from '@app/types/carcasse';

const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

// ----------------------------------------------------------------------------
// RequestNewCarcasseButton
// Ouvre une modal pour pré-remplir une carcasse manquante. L'intermédiaire crée
// localement (1) une Carcasse sans signature examinateur, (2) une CI row pour
// son passage (pour qu'elle apparaisse dans sa liste plutôt que dans
// "déjà refusées") et (3) une demande de type NEW_CARCASSE. Tout part par le
// pipeline /sync ; le backend notifie l'examinateur initial et lui présentera
// l'examen à signer.
// ----------------------------------------------------------------------------
export default function RequestNewCarcasseButton({
  feiNumero,
  transmission,
  intermediaire,
  className,
}: {
  feiNumero: string;
  intermediaire: CarcassesIntermediaire;
  className?: string;
  transmission: CarcasseTransmission;
}) {
  const user = useUser((state) => state.user);
  const fei = useZustandStore((state) => state.feis[feiNumero]);
  const createCarcasse = useZustandStore((state) => state.createCarcasse);
  const createCarcassesIntermediaire = useZustandStore((state) => state.createCarcassesIntermediaire);
  const createCarcasseModifRequest = useZustandStore((state) => state.createCarcasseModifRequest);

  const modal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `modif-new-carcasse-${feiNumero}`,
    })
  ).current;
  const isOpen = useIsModalOpen(modal);

  const [numeroBracelet, setNumeroBracelet] = useState('');
  const [espece, setEspece] = useState('');
  const [nombreAnimaux, setNombreAnimaux] = useState('1');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPetitGibier = useMemo(() => petitGibier.especes.includes(espece), [espece]);
  const carcasseType = isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER;
  const zacharieCarcasseId = `${feiNumero}_${numeroBracelet}`;

  const onSubmit = () => {
    setError(null);
    if (!user) {
      setError('Utilisateur non connecté.');
      return;
    }
    if (!fei) {
      setError('Fiche introuvable.');
      return;
    }
    if (!fei.examinateur_initial_user_id) {
      setError("Pas d'examinateur initial sur cette fiche.");
      return;
    }
    if (!numeroBracelet.trim()) {
      setError('Veuillez saisir un numéro de marquage.');
      return;
    }
    if (!espece) {
      setError("Veuillez sélectionner l'espèce.");
      return;
    }

    // If the FEI has already been transmitted to the next owner (SVI typically) before the carcasse
    // is added, inherit the transmission state on the new carcasse so it joins the same flow rather
    // than getting stranded at the requester. Without this, the SVI never sees the carcasse and the
    // ETG is asked to re-transmit endlessly after approval.
    const feiAlreadyTransmitted = !!transmission.next_owner_entity_id;
    const feiAlreadyAssignedToSvi = !!transmission.svi_assigned_at && !!transmission.svi_entity_id;

    // 1) Create the Carcasse locally with no examinateur signature — the examinateur will sign on
    // approval. Fields not set here keep their default/null from the carcasse schema.
    const newCarcasse: Carcasse = {
      zacharie_carcasse_id: zacharieCarcasseId,
      fei_numero: feiNumero,
      numero_bracelet: numeroBracelet.trim(),
      espece,
      type: carcasseType,
      nombre_d_animaux: nombreAnimaux ? Number(nombreAnimaux) : 1,
      heure_mise_a_mort: null,
      heure_evisceration: null,
      heure_mise_a_mort_premiere_carcasse_fei: null,
      heure_evisceration_derniere_carcasse_fei: null,
      consommateur_final_usage_domestique: null,
      date_mise_a_mort: fei.date_mise_a_mort,
      // EXAMINATEUR fields intentionally left null — filled on approval
      examinateur_carcasse_sans_anomalie: null,
      examinateur_anomalies_carcasse: [],
      examinateur_anomalies_abats: [],
      examinateur_commentaire: null,
      examinateur_signed_at: null,
      // PREMIER DETENTEUR caches (inherit from FEI)
      premier_detenteur_depot_type: transmission.premier_detenteur_depot_type ?? null,
      premier_detenteur_depot_entity_id: transmission.premier_detenteur_depot_entity_id ?? null,
      premier_detenteur_depot_entity_name_cache:
        transmission.premier_detenteur_depot_entity_name_cache ?? null,
      premier_detenteur_depot_ccg_at: transmission.premier_detenteur_depot_ccg_at ?? null,
      premier_detenteur_transport_type: transmission.premier_detenteur_transport_type ?? null,
      premier_detenteur_transport_date: transmission.premier_detenteur_transport_date ?? null,
      premier_detenteur_prochain_detenteur_role_cache:
        transmission.premier_detenteur_prochain_detenteur_role_cache ?? null,
      premier_detenteur_prochain_detenteur_id_cache:
        transmission.premier_detenteur_prochain_detenteur_id_cache ?? null,
      // INTERMEDIAIRE
      intermediaire_carcasse_refus_intermediaire_id: null,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_manquante: false,
      latest_intermediaire_signed_at: null,
      svi_carcasse_commentaire: null,
      svi_carcasse_status: null,
      svi_carcasse_status_set_at: null,
      svi_ipm1_date: null,
      svi_ipm1_presentee_inspection: null,
      svi_ipm1_user_id: null,
      svi_ipm1_user_name_cache: null,
      svi_ipm1_protocole: null,
      svi_ipm1_pieces: [],
      svi_ipm1_lesions_ou_motifs: [],
      svi_ipm1_nombre_animaux: null,
      svi_ipm1_commentaire: null,
      svi_ipm1_decision: null,
      svi_ipm1_duree_consigne: null,
      svi_ipm1_poids_consigne: null,
      svi_ipm1_poids_type: null,
      svi_ipm1_signed_at: null,
      svi_ipm2_date: null,
      svi_ipm2_presentee_inspection: null,
      svi_ipm2_user_id: null,
      svi_ipm2_user_name_cache: null,
      svi_ipm2_protocole: null,
      svi_ipm2_pieces: [],
      svi_ipm2_lesions_ou_motifs: [],
      svi_ipm2_nombre_animaux: null,
      svi_ipm2_commentaire: null,
      svi_ipm2_decision: null,
      svi_ipm2_traitement_assainissant: [],
      svi_ipm2_traitement_assainissant_cuisson_temps: null,
      svi_ipm2_traitement_assainissant_cuisson_temp: null,
      svi_ipm2_traitement_assainissant_congelation_temps: null,
      svi_ipm2_traitement_assainissant_congelation_temp: null,
      svi_ipm2_traitement_assainissant_type: null,
      svi_ipm2_traitement_assainissant_paramètres: null,
      svi_ipm2_traitement_assainissant_etablissement: null,
      svi_ipm2_traitement_assainissant_poids: null,
      svi_ipm2_poids_saisie: null,
      svi_ipm2_poids_type: null,
      svi_ipm2_signed_at: null,
      // ownership copies (from FEI)
      created_by_user_id: user.id,
      examinateur_initial_offline: null,
      examinateur_initial_user_id: fei.examinateur_initial_user_id,
      examinateur_initial_approbation_mise_sur_le_marche: null,
      examinateur_initial_date_approbation_mise_sur_le_marche: null,
      premier_detenteur_offline: null,
      premier_detenteur_user_id: fei.premier_detenteur_user_id,
      premier_detenteur_entity_id: fei.premier_detenteur_entity_id,
      premier_detenteur_name_cache: fei.premier_detenteur_name_cache,
      intermediaire_closed_at: null,
      intermediaire_closed_by_user_id: null,
      intermediaire_closed_by_entity_id: null,
      latest_intermediaire_user_id: null,
      latest_intermediaire_entity_id: null,
      latest_intermediaire_name_cache: null,
      svi_assigned_at: feiAlreadyAssignedToSvi ? (transmission.svi_assigned_at ?? null) : null,
      svi_entity_id: feiAlreadyAssignedToSvi ? (transmission.svi_entity_id ?? null) : null,
      svi_user_id: null,
      svi_closed_at: null,
      svi_automatic_closed_at: null,
      svi_closed_by_user_id: null,
      current_owner_user_id: transmission.current_owner_user_id ?? null,
      current_owner_user_name_cache: transmission.current_owner_user_name_cache ?? null,
      current_owner_entity_id: transmission.current_owner_entity_id ?? null,
      current_owner_entity_name_cache: transmission.current_owner_entity_name_cache ?? null,
      current_owner_role: transmission.current_owner_role ?? null,
      next_owner_wants_to_sous_traite: null,
      next_owner_sous_traite_at: null,
      next_owner_sous_traite_by_user_id: null,
      next_owner_sous_traite_by_entity_id: null,
      next_owner_user_id: feiAlreadyTransmitted ? (transmission.next_owner_user_id ?? null) : null,
      next_owner_user_name_cache: feiAlreadyTransmitted
        ? (transmission.next_owner_user_name_cache ?? null)
        : null,
      next_owner_entity_id: feiAlreadyTransmitted ? (transmission.next_owner_entity_id ?? null) : null,
      next_owner_entity_name_cache: feiAlreadyTransmitted
        ? (transmission.next_owner_entity_name_cache ?? null)
        : null,
      next_owner_role: feiAlreadyTransmitted ? (transmission.next_owner_role ?? null) : null,
      prev_owner_user_id: null,
      prev_owner_entity_id: null,
      prev_owner_role: null,
      // TRICHINE
      trichine_action_requise: null,
      consommateur_final_email: null,
      notifier_consommateur: false,
      consommateur_notifie_at: null,
      trichine_retire_de_fei_at: null,
      trichine_retire_de_fei_motif: null,
      trichine_retire_de_fei_user_id: null,
      created_at: dayjs().toDate(),
      updated_at: dayjs().toDate(),
      deleted_at: null,
      is_synced: false,
    };

    const modifRequest: CarcasseModificationRequest = {
      id: uuidv4(),
      type: CarcasseModificationRequestType.NEW_CARCASSE,
      status: CarcasseModificationRequestStatus.PENDING,
      zacharie_carcasse_id: zacharieCarcasseId,
      fei_numero: feiNumero,
      requested_by_user_id: user.id,
      requested_by_entity_id: intermediaire.intermediaire_entity_id,
      requested_at: dayjs().toDate(),
      comment_intermediaire: comment.trim() || null,
      numero_bracelet_before: null,
      numero_bracelet_after: null,
      reviewed_by_user_id: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: dayjs().toDate(),
      updated_at: dayjs().toDate(),
      deleted_at: null,
      is_synced: false,
    };
    createCarcasse(newCarcasse);

    // 2) Create the CarcasseIntermediaire row for the current intermediaire so the new carcasse
    // appears in their main list (and not in "Carcasses déjà refusées").
    createCarcassesIntermediaire([intermediaire], [zacharieCarcasseId]);

    // 3) Create the modif request — the backend's side effects will notify the examinateur.
    createCarcasseModifRequest(modifRequest);
    syncData('RequestNewCarcasseForm.onSubmit');

    setNumeroBracelet('');
    setEspece('');
    setNombreAnimaux('1');
    setComment('');
    modal.close();
  };

  return (
    <>
      <Button
        priority="secondary"
        size="small"
        onClick={() => modal.open()}
        className={className}
        type="button"
      >
        Ajouter une carcasse manquante
      </Button>
      <modal.Component title="Ajouter une carcasse manquante">
        {isOpen && (
          <div>
            <p className="mb-4 text-sm">
              Vous avez physiquement une carcasse qui semble être oubliée sur cette fiche d'examen initial.
              Pré-remplissez ses informations : l'examinateur initial recevra une demande à signer pour
              valider son examen et la mettre sur le marché.
            </p>
            <Input
              label="Numéro de marquage *"
              nativeInputProps={{
                value: numeroBracelet,
                onChange: (e) => setNumeroBracelet(e.currentTarget.value),
              }}
            />
            <Select
              label="Espèce *"
              nativeSelectProps={{
                value: espece,
                onChange: (e) => setEspece(e.currentTarget.value),
              }}
            >
              <option value="">Sélectionnez l'espèce</option>
              {Object.entries(gibierSelect).map(([typeGibier, especes]) => (
                <optgroup
                  label={typeGibier}
                  key={typeGibier}
                >
                  {especes.map((e) => (
                    <option
                      key={e}
                      value={e}
                    >
                      {e}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {isPetitGibier && (
              <Input
                label="Nombre d'animaux dans le lot *"
                nativeInputProps={{
                  type: 'number',
                  min: 1,
                  value: nombreAnimaux,
                  onChange: (e) => setNombreAnimaux(e.currentTarget.value),
                }}
              />
            )}
            <Input
              label="Commentaire pour l'examinateur (optionnel)"
              textArea
              nativeTextAreaProps={{
                value: comment,
                onChange: (e) => setComment(e.currentTarget.value),
                rows: 3,
              }}
            />
            {error && <p className="text-action-high-red-marianne mt-1 text-sm">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button
                priority="primary"
                onClick={onSubmit}
                type="button"
              >
                Envoyer la demande
              </Button>
              <Button
                priority="secondary"
                onClick={() => modal.close()}
                type="button"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </modal.Component>
    </>
  );
}
