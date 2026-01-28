import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcasseResponse, CarcassesGetForRegistryResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import {
  Carcasse,
  EntityRelationStatus,
  EntityRelationType,
  Fei,
  FeiOwnerRole,
  IPM2Decision,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import {
  formatCarcasseChasseurEmail,
  formatCarcasseManquanteOrRefusEmail,
  formatSaisieEmail,
} from '~/utils/formatCarcasseEmail';
import { RequestWithUser } from '~/types/request';
import { carcasseForRegistrySelect, CarcasseForResponseForRegistry } from '~/types/carcasse';
import updateCarcasseStatus from '~/utils/get-carcasse-status';
import { checkGenerateCertificat } from '~/utils/generate-certificats';
import { mapCarcasseForRegistry } from '~/utils/carcasse-for-registry';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface SaveCarcasseResult {
  savedCarcasse: Carcasse;
  existingCarcasse: Carcasse | null;
  isNew: boolean;
  isDeleted: boolean;
}

/**
 * Core save logic for Carcasse without Express req/res
 * Returns the saved carcasse and the previous state for side effect comparison
 */
export async function saveCarcasse(
  feiNumero: string,
  zacharieCarcasseId: string,
  body: Prisma.CarcasseUncheckedCreateInput,
  user: User,
  tx: PrismaTransactionClient = prisma,
): Promise<SaveCarcasseResult> {
  // Check if FEI exists
  const existingFei = await tx.fei.findUnique({
    where: { numero: feiNumero },
  });
  if (!existingFei) {
    throw new Error('Fiche non trouvée');
  }

  let existingCarcasse = await tx.carcasse.findFirst({
    where: {
      zacharie_carcasse_id: zacharieCarcasseId,
      fei_numero: feiNumero,
    },
  });

  // Create new carcasse if it doesn't exist
  if (!existingCarcasse) {
    const numeroBracelet = body.numero_bracelet;
    if (!numeroBracelet) {
      throw new Error('Le numéro de marquage est obligatoire');
    }
    existingCarcasse = await tx.carcasse.create({
      data: {
        zacharie_carcasse_id: zacharieCarcasseId,
        fei_numero: feiNumero,
        numero_bracelet: body.numero_bracelet,
        is_synced: true,
      },
    });
  }

  // Handle deletion
  if (body.deleted_at) {
    const deletedCarcasse = await tx.carcasse.update({
      where: {
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
      },
      data: {
        deleted_at: body.deleted_at,
        is_synced: true,
      },
    });
    await tx.carcasseIntermediaire.updateMany({
      where: { zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id },
      data: { deleted_at: body.deleted_at },
    });
    return { savedCarcasse: deletedCarcasse, existingCarcasse, isNew: false, isDeleted: true };
  }

  // Build update object
  const nextCarcasse = buildCarcasseUpdateData(body, user);

  const updatedCarcasse = await tx.carcasse.update({
    where: {
      zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
    },
    data: nextCarcasse,
  });

  return {
    savedCarcasse: updatedCarcasse,
    existingCarcasse,
    isNew: false,
    isDeleted: false,
  };
}

/**
 * Build the Carcasse update data object from request body
 */
function buildCarcasseUpdateData(
  body: Prisma.CarcasseUncheckedCreateInput,
  user: User,
): Prisma.CarcasseUncheckedUpdateInput {
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

  // SVI-specific fields (only if user has SVI role)
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
      nextCarcasse.svi_ipm1_lesions_ou_motifs = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_lesions_ou_motifs];
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
      nextCarcasse.svi_ipm2_lesions_ou_motifs = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_lesions_ou_motifs];
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
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temps)) {
      nextCarcasse.svi_ipm2_traitement_assainissant_congelation_temps =
        body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temps];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temp)) {
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

  return nextCarcasse;
}

/**
 * Run side effects after Carcasse save (notifications, certificates)
 * These should run AFTER the transaction commits
 */
export async function runCarcasseSideEffects(
  savedCarcasse: Carcasse,
  existingCarcasse: Carcasse | null,
): Promise<void> {
  if (!existingCarcasse) {
    return;
  }

  // Notification: SAISIE (on IPM2 seizure decision)
  if (
    existingCarcasse.svi_ipm2_decision !== savedCarcasse.svi_ipm2_decision &&
    (savedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE ||
      savedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE)
  ) {
    const [examinateurInitial, premierDetenteur] = await prisma.fei
      .findUnique({
        where: {
          numero: existingCarcasse.fei_numero,
        },
        include: {
          FeiExaminateurInitialUser: true,
          FeiPremierDetenteurUser: true,
        },
      })
      .then((fei) => {
        return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
      });

    const [object, email] = formatSaisieEmail(savedCarcasse);

    await sendNotificationToUser({
      user: examinateurInitial!,
      title: object,
      body: email,
      email: email,
      notificationLogAction: `CARCASSE_SAISIE_${savedCarcasse.zacharie_carcasse_id}`,
    });

    if (premierDetenteur?.id !== examinateurInitial?.id) {
      await sendNotificationToUser({
        user: premierDetenteur!,
        title: object,
        body: email,
        email: email,
        notificationLogAction: `CARCASSE_SAISIE_${savedCarcasse.zacharie_carcasse_id}`,
      });
    }
  }

  // Notification: MANQUANTE (on missing flag)
  if (!existingCarcasse.intermediaire_carcasse_manquante && savedCarcasse.intermediaire_carcasse_manquante) {
    const [examinateurInitial, premierDetenteur] = await prisma.fei
      .findUnique({
        where: {
          numero: existingCarcasse.fei_numero,
        },
        include: {
          FeiExaminateurInitialUser: true,
          FeiPremierDetenteurUser: true,
        },
      })
      .then((fei) => {
        return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
      });

    const [object, email] = await formatCarcasseManquanteOrRefusEmail(savedCarcasse);

    await sendNotificationToUser({
      user: examinateurInitial!,
      title: object,
      body: email,
      email: email,
      notificationLogAction: `CARCASSE_MANQUANTE_${savedCarcasse.zacharie_carcasse_id}`,
    });

    if (premierDetenteur?.id !== examinateurInitial?.id) {
      await sendNotificationToUser({
        user: premierDetenteur!,
        title: object,
        body: email,
        email: email,
        notificationLogAction: `CARCASSE_MANQUANTE_${savedCarcasse.zacharie_carcasse_id}`,
      });
    }
  }

  // Notification: REFUS (on refusal)
  if (
    !existingCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    savedCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    savedCarcasse.intermediaire_carcasse_refus_motif
  ) {
    const [examinateurInitial, premierDetenteur] = await prisma.fei
      .findUnique({
        where: {
          numero: existingCarcasse.fei_numero,
        },
        include: {
          FeiExaminateurInitialUser: true,
          FeiPremierDetenteurUser: true,
        },
      })
      .then((fei) => {
        return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
      });

    const [object, email] = await formatCarcasseManquanteOrRefusEmail(savedCarcasse);
    await sendNotificationToUser({
      user: examinateurInitial!,
      title: object,
      body: email,
      email: email,
      notificationLogAction: `CARCASSE_REFUS_${savedCarcasse.zacharie_carcasse_id}`,
    });

    if (premierDetenteur?.id !== examinateurInitial?.id) {
      await sendNotificationToUser({
        user: premierDetenteur!,
        title: object,
        body: email,
        email: email,
        notificationLogAction: `CARCASSE_REFUS_${savedCarcasse.zacharie_carcasse_id}`,
      });
    }
  }

  // Certificate generation on IPM date changes
  if (savedCarcasse.svi_ipm1_date || savedCarcasse.svi_ipm2_date) {
    await checkGenerateCertificat(existingCarcasse, savedCarcasse);
  }
}

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
      if (!fei_numero) {
        res.status(400).send({
          ok: false,
          data: { carcasse: null },
          error: 'Le numéro de fiche est obligatoire',
        });
        return;
      }
      if (!zacharie_carcasse_id) {
        res.status(400).send({
          ok: false,
          data: { carcasse: null },
          error: 'Le numéro de la carcasse est obligatoire',
        });
        return;
      }

      try {
        const result = await saveCarcasse(fei_numero, zacharie_carcasse_id, body, user);

        // Run side effects after save (notifications, certificates)
        if (!result.isDeleted) {
          await runCarcasseSideEffects(result.savedCarcasse, result.existingCarcasse);
        }

        res.status(200).send({
          ok: true,
          data: { carcasse: result.savedCarcasse },
          error: '',
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Fiche non trouvée') {
            res.status(404).send({ ok: false, data: { carcasse: null }, error: error.message });
            return;
          }
          if (error.message === 'Le numéro de marquage est obligatoire') {
            res.status(400).send({ ok: false, data: { carcasse: null }, error: error.message });
            return;
          }
        }
        throw error;
      }
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
