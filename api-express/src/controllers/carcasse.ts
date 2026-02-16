import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcasseResponse, CarcassesGetForRegistryResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import {
  Carcasse,
  EntityRelationStatus,
  EntityRelationType,
  FeiOwnerRole,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
import { RequestWithUser } from '~/types/request';
import { carcasseForRegistrySelect, CarcasseForResponseForRegistry } from '~/types/carcasse';
import updateCarcasseStatus from '~/utils/get-carcasse-status';
import { mapCarcasseForRegistry } from '~/utils/carcasse-for-registry';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';

// prisma.carcasse
//   .findMany({
//     where: {},
//   })
//   .then(async (carcasses) => {
//     for (const carcasse of carcasses) {
//       const status = updateCarcasseStatus(carcasse);
//       await prisma.carcasse.update({
//         where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
//         data: { svi_carcasse_status: status },
//       });
//     }
//     console.log('done');
//   });

export interface SaveCarcasseResult {
  savedCarcasse: Carcasse;
  existingCarcasse: Carcasse;
  isDeleted: boolean;
}

export async function saveCarcasse(
  fei_numero: string,
  zacharie_carcasse_id: string,
  body: Prisma.CarcasseUncheckedCreateInput,
  user: User,
): Promise<SaveCarcasseResult> {
  if (!fei_numero) {
    throw new Error('Le numéro de fiche est obligatoire');
  }
  const existingFei = await prisma.fei.findUnique({
    where: { numero: fei_numero },
  });
  if (!existingFei) {
    throw new Error('Fiche non trouvée');
  }
  if (!zacharie_carcasse_id) {
    throw new Error('Le numéro de la carcasse est obligatoire');
  }
  let existingCarcasse = await prisma.carcasse.findFirst({
    where: {
      zacharie_carcasse_id: zacharie_carcasse_id,
      fei_numero: fei_numero,
    },
  });
  if (!existingCarcasse) {
    const numeroBracelet = body.numero_bracelet;
    if (!numeroBracelet) {
      throw new Error('Le numéro de marquage est obligatoire');
    }
    existingCarcasse = await prisma.carcasse.create({
      data: {
        zacharie_carcasse_id,
        fei_numero,
        numero_bracelet: body.numero_bracelet,
        is_synced: true,
      },
    });
  }

  if (body.deleted_at) {
    const existinCarcasse = await prisma.carcasse.findFirst({
      where: {
        zacharie_carcasse_id,
        fei_numero: fei_numero,
      },
    });
    if (!existinCarcasse) {
      return { savedCarcasse: existingCarcasse, existingCarcasse, isDeleted: true };
    }
    const deletedCarcasse = await prisma.carcasse.update({
      where: {
        zacharie_carcasse_id: existinCarcasse.zacharie_carcasse_id,
      },
      data: {
        deleted_at: body.deleted_at,
        is_synced: true,
      },
    });
    await prisma.carcasseIntermediaire.updateMany({
      where: { zacharie_carcasse_id: existinCarcasse.zacharie_carcasse_id },
      data: { deleted_at: body.deleted_at },
    });
    return { savedCarcasse: deletedCarcasse, existingCarcasse, isDeleted: true };
  }

  const nextCarcasse: Prisma.CarcasseUncheckedUpdateInput = {
    is_synced: true,
  };

  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.numero_bracelet)) {
    nextCarcasse.numero_bracelet = body.numero_bracelet;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_evisceration)) {
    nextCarcasse.heure_evisceration = body.heure_evisceration;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.type)) {
    nextCarcasse.type = body[Prisma.CarcasseScalarFieldEnum.type];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.date_mise_a_mort)) {
    nextCarcasse.date_mise_a_mort = body.date_mise_a_mort;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.nombre_d_animaux)) {
    nextCarcasse.nombre_d_animaux = Number(body[Prisma.CarcasseScalarFieldEnum.nombre_d_animaux]);
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort)) {
    nextCarcasse.heure_mise_a_mort = body[Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.espece)) {
    nextCarcasse.espece = body[Prisma.CarcasseScalarFieldEnum.espece];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie)) {
    const nextValue = body[Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie];
    nextCarcasse.examinateur_carcasse_sans_anomalie = nextValue;
    if (nextValue === true) {
      nextCarcasse.examinateur_anomalies_carcasse = [];
      nextCarcasse.examinateur_anomalies_abats = [];
    }
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.created_by_user_id)) {
    nextCarcasse.created_by_user_id = body[Prisma.CarcasseScalarFieldEnum.created_by_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_initial_offline)) {
    nextCarcasse.examinateur_initial_offline =
      body[Prisma.CarcasseScalarFieldEnum.examinateur_initial_offline];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_initial_user_id)) {
    nextCarcasse.examinateur_initial_user_id =
      body[Prisma.CarcasseScalarFieldEnum.examinateur_initial_user_id];
  }
  if (
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche)
  ) {
    nextCarcasse.examinateur_initial_approbation_mise_sur_le_marche =
      body[Prisma.CarcasseScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche];
  }
  if (
    body.hasOwnProperty(
      Prisma.CarcasseScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
    )
  ) {
    nextCarcasse.examinateur_initial_date_approbation_mise_sur_le_marche =
      body[Prisma.CarcasseScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)) {
    const anomaliesCarcasses = (body.examinateur_anomalies_carcasse as string[]) || [];
    nextCarcasse.examinateur_anomalies_carcasse = anomaliesCarcasses.filter(Boolean);
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)) {
    const anomaliesAbats = (body.examinateur_anomalies_abats as string[]) || [];
    nextCarcasse.examinateur_anomalies_abats = anomaliesAbats.filter(Boolean);
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_commentaire)) {
    nextCarcasse.examinateur_commentaire = body[Prisma.CarcasseScalarFieldEnum.examinateur_commentaire];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at)) {
    nextCarcasse.examinateur_signed_at = body.examinateur_signed_at;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id)) {
    nextCarcasse.premier_detenteur_depot_entity_id = body.premier_detenteur_depot_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_name_cache)) {
    nextCarcasse.premier_detenteur_depot_entity_name_cache =
      body.premier_detenteur_depot_entity_name_cache || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_type)) {
    nextCarcasse.premier_detenteur_depot_type = body.premier_detenteur_depot_type || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_ccg_at)) {
    nextCarcasse.premier_detenteur_depot_ccg_at = body.premier_detenteur_depot_ccg_at || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_transport_type)) {
    nextCarcasse.premier_detenteur_transport_type = body.premier_detenteur_transport_type || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_transport_date)) {
    nextCarcasse.premier_detenteur_transport_date = body.premier_detenteur_transport_date || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_role_cache)) {
    nextCarcasse.premier_detenteur_prochain_detenteur_role_cache =
      body.premier_detenteur_prochain_detenteur_role_cache || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache)) {
    nextCarcasse.premier_detenteur_prochain_detenteur_id_cache =
      body.premier_detenteur_prochain_detenteur_id_cache || null;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_offline)) {
    nextCarcasse.premier_detenteur_offline = body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_offline];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_user_id)) {
    nextCarcasse.premier_detenteur_user_id = body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_entity_id)) {
    nextCarcasse.premier_detenteur_entity_id =
      body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_name_cache)) {
    nextCarcasse.premier_detenteur_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_name_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_closed_at)) {
    nextCarcasse.intermediaire_closed_at = body[Prisma.CarcasseScalarFieldEnum.intermediaire_closed_at];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_user_id)) {
    nextCarcasse.intermediaire_closed_by_user_id =
      body[Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_entity_id)) {
    nextCarcasse.intermediaire_closed_by_entity_id =
      body[Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_user_id)) {
    nextCarcasse.latest_intermediaire_user_id =
      body[Prisma.CarcasseScalarFieldEnum.latest_intermediaire_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_entity_id)) {
    nextCarcasse.latest_intermediaire_entity_id =
      body[Prisma.CarcasseScalarFieldEnum.latest_intermediaire_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_name_cache)) {
    nextCarcasse.latest_intermediaire_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.latest_intermediaire_name_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_assigned_at)) {
    nextCarcasse.svi_assigned_at = body[Prisma.CarcasseScalarFieldEnum.svi_assigned_at];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_entity_id)) {
    nextCarcasse.svi_entity_id = body[Prisma.CarcasseScalarFieldEnum.svi_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_user_id)) {
    nextCarcasse.svi_user_id = body[Prisma.CarcasseScalarFieldEnum.svi_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_closed_at)) {
    nextCarcasse.svi_closed_at = body[Prisma.CarcasseScalarFieldEnum.svi_closed_at];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_closed_by_user_id)) {
    nextCarcasse.svi_closed_by_user_id = body[Prisma.CarcasseScalarFieldEnum.svi_closed_by_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_user_id)) {
    nextCarcasse.current_owner_user_id = body[Prisma.CarcasseScalarFieldEnum.current_owner_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_user_name_cache)) {
    nextCarcasse.current_owner_user_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.current_owner_user_name_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_entity_id)) {
    nextCarcasse.current_owner_entity_id = body[Prisma.CarcasseScalarFieldEnum.current_owner_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_entity_name_cache)) {
    nextCarcasse.current_owner_entity_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.current_owner_entity_name_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_role)) {
    nextCarcasse.current_owner_role = body[Prisma.CarcasseScalarFieldEnum.current_owner_role];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_wants_to_sous_traite)) {
    nextCarcasse.next_owner_wants_to_sous_traite =
      body[Prisma.CarcasseScalarFieldEnum.next_owner_wants_to_sous_traite];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_at)) {
    nextCarcasse.next_owner_sous_traite_at = body[Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_at];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_user_id)) {
    nextCarcasse.next_owner_sous_traite_by_user_id =
      body[Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_entity_id)) {
    nextCarcasse.next_owner_sous_traite_by_entity_id =
      body[Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_user_id)) {
    nextCarcasse.next_owner_user_id = body[Prisma.CarcasseScalarFieldEnum.next_owner_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_user_name_cache)) {
    nextCarcasse.next_owner_user_name_cache = body[Prisma.CarcasseScalarFieldEnum.next_owner_user_name_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_entity_id)) {
    nextCarcasse.next_owner_entity_id = body[Prisma.CarcasseScalarFieldEnum.next_owner_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_entity_name_cache)) {
    nextCarcasse.next_owner_entity_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.next_owner_entity_name_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_role)) {
    nextCarcasse.next_owner_role = body[Prisma.CarcasseScalarFieldEnum.next_owner_role];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.prev_owner_user_id)) {
    nextCarcasse.prev_owner_user_id = body[Prisma.CarcasseScalarFieldEnum.prev_owner_user_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.prev_owner_entity_id)) {
    nextCarcasse.prev_owner_entity_id = body[Prisma.CarcasseScalarFieldEnum.prev_owner_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.prev_owner_role)) {
    nextCarcasse.prev_owner_role = body[Prisma.CarcasseScalarFieldEnum.prev_owner_role];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_signed_at)) {
    nextCarcasse.latest_intermediaire_signed_at = body.latest_intermediaire_signed_at;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante)) {
    const nextValue = body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante];
    nextCarcasse.intermediaire_carcasse_manquante = nextValue;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id)) {
    nextCarcasse.intermediaire_carcasse_refus_intermediaire_id =
      body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif)) {
    nextCarcasse.intermediaire_carcasse_refus_motif =
      body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_assigned_to_fei_at)) {
    nextCarcasse.svi_assigned_to_fei_at = body.svi_assigned_to_fei_at;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status)) {
    nextCarcasse.svi_carcasse_status = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at)) {
    nextCarcasse.svi_carcasse_status_set_at = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at];
  }

  if (user.roles.includes(UserRoles.SVI)) {
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire)) {
      nextCarcasse.svi_carcasse_commentaire = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_date)) {
      nextCarcasse.svi_ipm1_date = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_date];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_presentee_inspection)) {
      nextCarcasse.svi_ipm1_presentee_inspection =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_presentee_inspection];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_id)) {
      nextCarcasse.svi_ipm1_user_id = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_id];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_name_cache)) {
      nextCarcasse.svi_ipm1_user_name_cache = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_name_cache];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_protocole)) {
      nextCarcasse.svi_ipm1_protocole = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_protocole];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_pieces)) {
      nextCarcasse.svi_ipm1_pieces = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_pieces];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_lesions_ou_motifs)) {
      nextCarcasse.svi_ipm1_lesions_ou_motifs =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_lesions_ou_motifs];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_nombre_animaux)) {
      nextCarcasse.svi_ipm1_nombre_animaux = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_nombre_animaux];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_commentaire)) {
      nextCarcasse.svi_ipm1_commentaire = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_commentaire];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_decision)) {
      nextCarcasse.svi_ipm1_decision = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_decision];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_duree_consigne)) {
      nextCarcasse.svi_ipm1_duree_consigne = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_duree_consigne];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_poids_consigne)) {
      nextCarcasse.svi_ipm1_poids_consigne = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_poids_consigne];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_poids_type)) {
      nextCarcasse.svi_ipm1_poids_type = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_poids_type];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_signed_at)) {
      nextCarcasse.svi_ipm1_signed_at = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_signed_at];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_date)) {
      nextCarcasse.svi_ipm2_date = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_date];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_presentee_inspection)) {
      nextCarcasse.svi_ipm2_presentee_inspection =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_presentee_inspection];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_id)) {
      nextCarcasse.svi_ipm2_user_id = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_id];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_name_cache)) {
      nextCarcasse.svi_ipm2_user_name_cache = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_name_cache];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_protocole)) {
      nextCarcasse.svi_ipm2_protocole = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_protocole];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_pieces)) {
      nextCarcasse.svi_ipm2_pieces = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_pieces];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_lesions_ou_motifs)) {
      nextCarcasse.svi_ipm2_lesions_ou_motifs =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_lesions_ou_motifs];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_nombre_animaux)) {
      nextCarcasse.svi_ipm2_nombre_animaux = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_nombre_animaux];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_commentaire)) {
      nextCarcasse.svi_ipm2_commentaire = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_commentaire];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_decision)) {
      nextCarcasse.svi_ipm2_decision = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_decision];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant)) {
      nextCarcasse.svi_ipm2_traitement_assainissant =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temps)) {
      nextCarcasse.svi_ipm2_traitement_assainissant_cuisson_temps =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temps];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temp)) {
      nextCarcasse.svi_ipm2_traitement_assainissant_cuisson_temp =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temp];
    }
    if (
      body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temps)
    ) {
      nextCarcasse.svi_ipm2_traitement_assainissant_congelation_temps =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temps];
    }
    if (
      body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temp)
    ) {
      nextCarcasse.svi_ipm2_traitement_assainissant_congelation_temp =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temp];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_type)) {
      nextCarcasse.svi_ipm2_traitement_assainissant_type =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_type];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_paramètres)) {
      nextCarcasse.svi_ipm2_traitement_assainissant_paramètres =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_paramètres];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_etablissement)) {
      nextCarcasse.svi_ipm2_traitement_assainissant_etablissement =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_etablissement];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_poids)) {
      nextCarcasse.svi_ipm2_traitement_assainissant_poids =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_poids];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_poids_saisie)) {
      nextCarcasse.svi_ipm2_poids_saisie = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_poids_saisie];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_poids_type)) {
      nextCarcasse.svi_ipm2_poids_type = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_poids_type];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_signed_at)) {
      nextCarcasse.svi_ipm2_signed_at = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_signed_at];
    }
  }

  const updatedCarcasse = await prisma.carcasse.update({
    where: {
      zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
    },
    data: nextCarcasse,
  });

  return { savedCarcasse: updatedCarcasse, existingCarcasse, isDeleted: false };
}

router.post(
  '/:fei_numero/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<CarcasseResponse>, next: express.NextFunction) => {
      const body: Prisma.CarcasseUncheckedCreateInput = req.body;
      const user = req.user;
      if (!user.activated) {
        res.status(400).send({
          ok: false,
          data: { carcasse: null },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      const { fei_numero, zacharie_carcasse_id } = req.params;

      let result: SaveCarcasseResult;
      try {
        result = await saveCarcasse(fei_numero, zacharie_carcasse_id, body, user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        const status = message === 'Fiche non trouvée' ? 404 : 400;
        res.status(status).send({
          ok: false,
          data: { carcasse: null },
          error: message,
        });
        return;
      }

      if (!result.isDeleted) {
        await runCarcasseUpdateSideEffects(result.existingCarcasse, result.savedCarcasse);
      }

      res.status(200).send({
        ok: true,
        data: { carcasse: result.savedCarcasse },
        error: '',
      });
    },
  ),
);

router.get(
  '/svi',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetForRegistryResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    const userIsSvi = req.user?.roles.includes(UserRoles.SVI);
    if (!userIsSvi) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    // Parse and validate query parameters
    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      Fei: {
        svi_assigned_at: { not: null },
        deleted_at: null,
        FeiSviEntity: {
          EntityRelationsWithUsers: {
            some: {
              owner_id: req.user!.id,
              relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
              status: {
                in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
              },
            },
          },
        },
      },
    };
    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      if (includeDeleted) {
        where.OR = [
          // If we include deleted, we want to get all the carcasses updated after the date
          { updated_at: { gte: afterDate } },
          // And all the carcasses deleted after the date
          { deleted_at: { gte: afterDate } },
        ];
      } else {
        where.updated_at = { gte: afterDate };
      }
    }

    // Execute count and findMany in parallel
    const [total, data] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        select: carcasseForRegistrySelect,
        orderBy: { created_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        carcasses: data.map(mapCarcasseForRegistry),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    });
  }),
);

router.get(
  '/etg',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetForRegistryResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    const userIsEtg = req.user?.roles.includes(UserRoles.ETG);
    if (!userIsEtg) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      Fei: {
        deleted_at: null,
        CarcasseIntermediaire: {
          some: {
            CarcasseIntermediaireEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: req.user.id,
                  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                  status: {
                    in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                  },
                },
              },
            },
          },
        },
      },
    };
    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      if (includeDeleted) {
        where.OR = [
          // If we include deleted, we want to get all the carcasses updated after the date
          { updated_at: { gte: afterDate } },
          // And all the carcasses deleted after the date
          { deleted_at: { gte: afterDate } },
        ];
      } else {
        where.updated_at = { gte: afterDate };
      }
    }

    // Execute count and findMany in parallel
    const [total, data] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        select: carcasseForRegistrySelect,
        orderBy: { created_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        carcasses: data.map(mapCarcasseForRegistry),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    });
  }),
);

router.get(
  '/collecteur_pro',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<CarcassesGetForRegistryResponse>) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    const userIsCollecteurPro = req.user?.roles.includes(UserRoles.COLLECTEUR_PRO);
    if (!userIsCollecteurPro) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      Fei: {
        deleted_at: null,
        CarcasseIntermediaire: {
          some: {
            intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
            CarcasseIntermediaireEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: req.user.id,
                  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                  status: {
                    in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                  },
                },
              },
            },
          },
        },
      },
    };
    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      if (includeDeleted) {
        where.OR = [
          // If we include deleted, we want to get all the carcasses updated after the date
          { updated_at: { gte: afterDate } },
          // And all the carcasses deleted after the date
          { deleted_at: { gte: afterDate } },
        ];
      } else {
        where.updated_at = { gte: afterDate };
      }
    }

    // Execute count and findMany in parallel
    const [total, data] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        select: carcasseForRegistrySelect,
        orderBy: { created_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    res.status(200).json({
      ok: true,
      data: {
        carcasses: data.map(mapCarcasseForRegistry),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    });
  }),
);

router.get(
  '/:fei_numero/:numero_bracelet',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }
    if (!req.params.fei_numero) {
      res.status(400).send({ ok: false, data: null, error: 'Missing fei_numero' });
      return;
    }
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero as string,
      },
    });
    if (!fei) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const carcasse = await prisma.carcasse.findFirst({
      where: {
        numero_bracelet: req.params.numero_bracelet,
        fei_numero: req.params.fei_numero,
      },
    });
    if (!carcasse) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    res.status(200).send({
      ok: true,
      data: { carcasse },
      error: '',
    });
  }),
);

router.get(
  '/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<CarcasseResponse>, next: express.NextFunction) => {
      if (!req.user.activated) {
        res.status(400).send({
          ok: false,
          data: null,
          error: "Le compte n'est pas activé",
        });
        return;
      }

      const carcasse = await prisma.carcasse.findUnique({
        where: {
          zacharie_carcasse_id: req.params.zacharie_carcasse_id,
        },
        include: {
          Fei: true,
        },
      });
      if (!carcasse) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }

      res.status(200).send({
        ok: true,
        data: { carcasse },
        error: '',
      });
    },
  ),
);

export default router;
