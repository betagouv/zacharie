import dayjs from 'dayjs';
import {
  Carcasse,
  FeiOwnerRole,
  IPM1Decision,
  IPM1Protocole,
  TrichineResultatAnalyse,
  UserRoles,
} from '@prisma/client';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { getTrichineCarcasse } from '@app/services/trichine';
import { TRICHINE_FEATURE_ENABLED } from '@app/utils/trichine';

export type ApproveCarcasseResult = { ok: true } | { ok: false; error: string };

// Circuit agréé : pas d'acceptation d'un sanglier sans résultat trichine négatif (cf doc/trichine.md §6.2).
// Fail-closed : on bloque aussi si les analyses ne peuvent pas être chargées.
async function carcasseHasTrichineNegatif(zacharieCarcasseId: string): Promise<boolean> {
  try {
    const response = await getTrichineCarcasse(zacharieCarcasseId);
    if (!response.ok || !response.data) return false;
    const pools = new Map<string, TrichineResultatAnalyse | null>();
    for (const echantillon of response.data.carcasse.TrichineEchantillons) {
      const pool = echantillon.TrichinePool;
      if (pool && !pool.deleted_at) pools.set(pool.id, pool.resultat_analyse);
    }
    return [...pools.values()].includes(TrichineResultatAnalyse.NEGATIF);
  } catch {
    return false;
  }
}

// Acceptation en un clic côté SVI : équivaut à enregistrer une IPM1 avec la décision « Acceptée »
// (même flux que le handleSave de svi-inspection-carcasse/ipm1.tsx).
export function useApproveCarcasse() {
  const user = useUser((state) => state.user)!;
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const allCarcasses = useZustandStore((state) => state.carcasses);

  return async function approveCarcasse(carcasse: Carcasse): Promise<ApproveCarcasseResult> {
    if (carcasse.svi_ipm1_signed_at) {
      return { ok: false, error: 'Une IPM1 a déjà été enregistrée pour cette carcasse' };
    }
    if (TRICHINE_FEATURE_ENABLED && carcasse.espece === 'Sanglier') {
      const hasNegatif = await carcasseHasTrichineNegatif(carcasse.zacharie_carcasse_id);
      if (!hasNegatif) {
        return {
          ok: false,
          error:
            "Recherche trichine obligatoire avant acceptation : aucun résultat négatif n'est associé à cette carcasse de sanglier.",
        };
      }
    }

    let newCarcasseCommentaire = '';
    if (carcasse.svi_ipm1_commentaire) {
      newCarcasseCommentaire += `IPM1\u00A0: ${carcasse.svi_ipm1_commentaire}`;
      if (carcasse.svi_ipm2_commentaire) {
        newCarcasseCommentaire += `\n\n`;
      }
    }
    if (carcasse.svi_ipm2_commentaire) {
      newCarcasseCommentaire += `IPM2\u00A0: ${carcasse.svi_ipm2_commentaire}`;
    }

    const partialCarcasse: Partial<Carcasse> = {
      svi_ipm1_presentee_inspection: true,
      svi_ipm1_date: carcasse.svi_ipm1_date ?? dayjs.utc().startOf('day').toDate(),
      svi_ipm1_protocole: carcasse.svi_ipm1_protocole ?? IPM1Protocole.STANDARD,
      svi_ipm1_pieces: carcasse.svi_ipm1_pieces,
      svi_ipm1_lesions_ou_motifs: carcasse.svi_ipm1_lesions_ou_motifs,
      svi_ipm1_nombre_animaux: carcasse.svi_ipm1_nombre_animaux,
      svi_ipm1_commentaire: carcasse.svi_ipm1_commentaire,
      svi_carcasse_commentaire: newCarcasseCommentaire,
      svi_ipm1_decision: IPM1Decision.ACCEPTE,
      svi_ipm1_user_id: user.id,
      svi_ipm1_user_name_cache: carcasse.svi_ipm1_user_name_cache ?? `${user.prenom} ${user.nom_de_famille}`,
      svi_ipm1_duree_consigne: carcasse.svi_ipm1_duree_consigne,
      svi_ipm1_poids_consigne: carcasse.svi_ipm1_poids_consigne,
      svi_ipm1_poids_type: carcasse.svi_ipm1_poids_type,
      svi_ipm1_signed_at: dayjs.utc().toDate(),
      svi_assigned_at: carcasse.svi_assigned_at ?? dayjs.utc().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, partialCarcasse);
    if (carcasse.current_owner_role !== FeiOwnerRole.SVI) {
      // on ne met à jour que les carcasses du même groupe de transmission
      const carcasseIds = Object.values(allCarcasses)
        .filter((c) => !c.deleted_at)
        .filter((c) => c.fei_numero === carcasse.fei_numero)
        .filter(
          (c) =>
            c.premier_detenteur_prochain_detenteur_id_cache ===
            carcasse.premier_detenteur_prochain_detenteur_id_cache
        )
        .map((c) => c.zacharie_carcasse_id);
      updateCarcassesTransmission(carcasseIds, {
        current_owner_role: FeiOwnerRole.SVI,
        current_owner_entity_id: carcasse.next_owner_entity_id ?? null,
        current_owner_entity_name_cache: carcasse.next_owner_entity_name_cache ?? null,
        current_owner_user_id: user.id,
        current_owner_user_name_cache:
          carcasse.next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
        next_owner_role: null,
        next_owner_user_id: null,
        next_owner_user_name_cache: null,
        next_owner_entity_id: null,
        next_owner_entity_name_cache: null,
        prev_owner_role: carcasse.current_owner_role || null,
        prev_owner_user_id: carcasse.current_owner_user_id || null,
        prev_owner_entity_id: carcasse.current_owner_entity_id || null,
        svi_user_id: user.id,
      });
    }
    addLog({
      user_id: user.id,
      user_role: UserRoles.SVI,
      fei_numero: carcasse.fei_numero,
      action: 'svi-ipm1-edit',
      history: createHistoryInput(carcasse, partialCarcasse),
      entity_id: null,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData('svi-ipm1-edit');
    return { ok: true };
  };
}
