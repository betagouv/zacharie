import prisma from '~/prisma';
import { Carcasse, EntityRelationType, Prisma, User, UserRoles } from '@prisma/client';

export interface SaveCarcasseResult {
  savedCarcasse: Carcasse;
  existingCarcasse: Carcasse;
  isDeleted: boolean;
}

export async function syncCarcasse(
  fei_numero: string,
  zacharie_carcasse_id: string,
  body: Prisma.CarcasseUncheckedCreateInput,
  user: User
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
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort_premiere_carcasse_fei)) {
    nextCarcasse.heure_mise_a_mort_premiere_carcasse_fei =
      body[Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort_premiere_carcasse_fei];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.consommateur_final_usage_domestique)) {
    nextCarcasse.consommateur_final_usage_domestique =
      body[Prisma.CarcasseScalarFieldEnum.consommateur_final_usage_domestique];
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_evisceration_derniere_carcasse_fei)) {
    nextCarcasse.heure_evisceration_derniere_carcasse_fei =
      body[Prisma.CarcasseScalarFieldEnum.heure_evisceration_derniere_carcasse_fei];
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
      Prisma.CarcasseScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche
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
    // Create CAN_TRANSMIT_CARCASSES_TO_ENTITY relation (mirrors fei.ts pattern)
    if (body[Prisma.CarcasseScalarFieldEnum.next_owner_entity_id]) {
      const nextRelation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
        entity_id: body[Prisma.CarcasseScalarFieldEnum.next_owner_entity_id] as string,
        owner_id: user.id,
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        deleted_at: null,
      };
      const existingRelation = await prisma.entityAndUserRelations.findFirst({
        where: nextRelation,
      });
      if (!existingRelation) {
        await prisma.entityAndUserRelations.create({ data: nextRelation });
      }
    }
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
