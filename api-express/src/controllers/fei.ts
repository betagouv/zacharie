import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { FeiResponse, FeisResponse, FeisDoneResponse, FeiRefreshResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { PrismaClient, Prisma as PrismaNamespace } from '@prisma/client';
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  Fei,
  FeiOwnerRole,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import { feiPopulatedInclude, FeiPopulated } from '~/types/fei';
import {
  updateBrevoChasseurDeal,
  updateBrevoETGDealPremiereFiche,
  updateBrevoSVIDealPremiereFiche,
} from '~/third-parties/brevo';
import { formatManualValidationSviEmail, formatSviAssignedEmail } from '~/utils/formatCarcasseEmail';
import { sendWebhook } from '~/utils/api';
import { capture } from '~/third-parties/sentry';
import { getFichePdf } from '~/templates/get-fiche-pdf';
// import { refreshMaterializedViews } from '~/utils/refreshMaterializedViews';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface SaveFeiResult {
  savedFei: FeiPopulated;
  existingFei: FeiPopulated | null;
  isNew: boolean;
  isDeleted: boolean;
}

/**
 * Core save logic for FEI without Express req/res
 * Returns the saved FEI and the previous state for side effect comparison
 */
export async function saveFei(
  feiNumero: string,
  body: Prisma.FeiUncheckedCreateInput,
  user: User,
  tx: PrismaTransactionClient = prisma,
): Promise<SaveFeiResult> {
  let existingFei = await tx.fei.findUnique({
    where: { numero: feiNumero },
    include: feiPopulatedInclude,
  });

  // Validation: Only examinateur initial can create new FEI
  if (!existingFei) {
    const isExaminateurInitial =
      user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei && !!user.activated;
    if (!isExaminateurInitial) {
      throw new Error('Seul un examinateur initial peut créer une fiche');
    }
  }

  // If already deleted, return as-is
  if (existingFei?.deleted_at) {
    return { savedFei: existingFei, existingFei, isNew: false, isDeleted: true };
  }

  // Handle deletion
  if (body.deleted_at) {
    if (!existingFei) {
      throw new Error('Fei not found for deletion');
    }
    const canDelete =
      user.roles.includes(UserRoles.ADMIN) ||
      (user.roles.includes(UserRoles.CHASSEUR) && existingFei.examinateur_initial_user_id === user.id) ||
      (user.roles.includes(UserRoles.CHASSEUR) && existingFei.fei_current_owner_user_id === user.id);
    if (!canDelete) {
      throw new Error('Unauthorized to delete');
    }
    const deletedFei = await tx.fei.update({
      where: { numero: feiNumero },
      data: { deleted_at: body.deleted_at },
      include: feiPopulatedInclude,
    });
    await tx.carcasse.updateMany({
      where: { fei_numero: feiNumero },
      data: { deleted_at: body.deleted_at },
    });
    await tx.carcasseIntermediaire.updateMany({
      where: { fei_numero: feiNumero },
      data: { deleted_at: body.deleted_at },
    });
    return { savedFei: deletedFei, existingFei, isNew: false, isDeleted: true };
  }

  // Build update object
  const nextFei = buildFeiUpdateData(body, user);

  // Handle entity relation creation for fei_next_owner_entity_id
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
    nextFei.fei_next_owner_entity_id = body.fei_next_owner_entity_id || null;
    if (body.fei_next_owner_entity_id) {
      const nextRelation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
        entity_id: body.fei_next_owner_entity_id,
        owner_id: user.id,
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        deleted_at: null,
      };
      const existingRelation = await tx.entityAndUserRelations.findFirst({
        where: nextRelation,
      });
      if (!existingRelation) {
        await tx.entityAndUserRelations.create({ data: nextRelation });
      }
    }
  }

  const savedFei = existingFei
    ? await tx.fei.update({
        where: { numero: feiNumero },
        data: nextFei,
        include: feiPopulatedInclude,
      })
    : await tx.fei.create({
        data: {
          ...(nextFei as Prisma.FeiUncheckedCreateInput),
          numero: feiNumero,
          created_by_user_id: user.id,
        },
        include: feiPopulatedInclude,
      });

  // Update carcasse dates if FEI date changed
  if (existingFei && existingFei.date_mise_a_mort !== savedFei.date_mise_a_mort) {
    await tx.carcasse.updateMany({
      where: { fei_numero: feiNumero },
      data: { date_mise_a_mort: savedFei.date_mise_a_mort },
    });
  }

  return {
    savedFei,
    existingFei: existingFei ?? null,
    isNew: !existingFei,
    isDeleted: false,
  };
}

/**
 * Build the FEI update data object from request body
 */
function buildFeiUpdateData(
  body: Prisma.FeiUncheckedCreateInput,
  user: User,
): Prisma.FeiUncheckedUpdateInput {
  const nextFei: Prisma.FeiUncheckedUpdateInput = {
    is_synced: true,
  };

  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
    nextFei.date_mise_a_mort = body.date_mise_a_mort || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.creation_context)) {
    // Note: context validation should be done separately if needed
    nextFei.creation_context = body.creation_context || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.commune_mise_a_mort)) {
    nextFei.commune_mise_a_mort = body.commune_mise_a_mort || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse)) {
    nextFei.heure_mise_a_mort_premiere_carcasse = body.heure_mise_a_mort_premiere_carcasse || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse)) {
    nextFei.heure_evisceration_derniere_carcasse = body.heure_evisceration_derniere_carcasse || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.created_by_user_id)) {
    nextFei.created_by_user_id = body.created_by_user_id;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.resume_nombre_de_carcasses)) {
    nextFei.resume_nombre_de_carcasses = body.resume_nombre_de_carcasses || null;
  }

  // Examinateur initial
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    nextFei.examinateur_initial_user_id = body.examinateur_initial_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_offline)) {
    nextFei.examinateur_initial_offline = body.examinateur_initial_offline || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche)) {
    nextFei.examinateur_initial_approbation_mise_sur_le_marche =
      body.examinateur_initial_approbation_mise_sur_le_marche || null;
  }
  if (
    body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche)
  ) {
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche =
      body.examinateur_initial_date_approbation_mise_sur_le_marche || null;
  }

  // Premier détenteur
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
    nextFei.premier_detenteur_user_id = body.premier_detenteur_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_offline)) {
    nextFei.premier_detenteur_offline = body.premier_detenteur_offline || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_entity_id)) {
    nextFei.premier_detenteur_entity_id = body.premier_detenteur_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache)) {
    nextFei.premier_detenteur_name_cache = body.premier_detenteur_name_cache || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id)) {
    nextFei.premier_detenteur_depot_entity_id = body.premier_detenteur_depot_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_name_cache)) {
    nextFei.premier_detenteur_depot_entity_name_cache =
      body.premier_detenteur_depot_entity_name_cache || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_type)) {
    nextFei.premier_detenteur_depot_type = body.premier_detenteur_depot_type || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_ccg_at)) {
    nextFei.premier_detenteur_depot_ccg_at = body.premier_detenteur_depot_ccg_at || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_transport_type)) {
    nextFei.premier_detenteur_transport_type = body.premier_detenteur_transport_type || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_transport_date)) {
    nextFei.premier_detenteur_transport_date = body.premier_detenteur_transport_date || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_role_cache)) {
    nextFei.premier_detenteur_prochain_detenteur_role_cache =
      body.premier_detenteur_prochain_detenteur_role_cache || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache)) {
    nextFei.premier_detenteur_prochain_detenteur_id_cache =
      body.premier_detenteur_prochain_detenteur_id_cache || null;
  }

  // Current Owner
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id)) {
    nextFei.fei_current_owner_user_id = body.fei_current_owner_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_user_name_cache)) {
    nextFei.fei_current_owner_user_name_cache = body.fei_current_owner_user_name_cache || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
    nextFei.fei_current_owner_entity_id = body.fei_current_owner_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_name_cache)) {
    nextFei.fei_current_owner_entity_name_cache = body.fei_current_owner_entity_name_cache || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_role)) {
    nextFei.fei_current_owner_role = body.fei_current_owner_role || null;
  }

  // Sous-traitance
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_wants_to_sous_traite)) {
    nextFei.fei_next_owner_wants_to_sous_traite = body.fei_next_owner_wants_to_sous_traite || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_sous_traite_at)) {
    nextFei.fei_next_owner_sous_traite_at = body.fei_next_owner_sous_traite_at || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_sous_traite_by_user_id)) {
    nextFei.fei_next_owner_sous_traite_by_user_id = body.fei_next_owner_sous_traite_by_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_sous_traite_by_entity_id)) {
    nextFei.fei_next_owner_sous_traite_by_entity_id = body.fei_next_owner_sous_traite_by_entity_id || null;
  }

  // Next Owner
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
    nextFei.fei_next_owner_user_id = body.fei_next_owner_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_user_name_cache)) {
    nextFei.fei_next_owner_user_name_cache = body.fei_next_owner_user_name_cache || null;
  }
  // Note: fei_next_owner_entity_id is handled separately due to relation creation
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_name_cache)) {
    nextFei.fei_next_owner_entity_name_cache = body.fei_next_owner_entity_name_cache || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_role)) {
    nextFei.fei_next_owner_role = body.fei_next_owner_role || null;
  }

  // Prev Owner
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id)) {
    nextFei.fei_prev_owner_user_id = body.fei_prev_owner_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id)) {
    nextFei.fei_prev_owner_entity_id = body.fei_prev_owner_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_role)) {
    nextFei.fei_prev_owner_role = body.fei_prev_owner_role || null;
  }

  // Intermédiaire
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_at)) {
    nextFei.intermediaire_closed_at = body.intermediaire_closed_at || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_by_user_id)) {
    nextFei.intermediaire_closed_by_user_id = body.intermediaire_closed_by_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_by_entity_id)) {
    nextFei.intermediaire_closed_by_entity_id = body.intermediaire_closed_by_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.latest_intermediaire_user_id)) {
    nextFei.latest_intermediaire_user_id = body.latest_intermediaire_user_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.latest_intermediaire_entity_id)) {
    nextFei.latest_intermediaire_entity_id = body.latest_intermediaire_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.latest_intermediaire_name_cache)) {
    nextFei.latest_intermediaire_name_cache = body.latest_intermediaire_name_cache || null;
  }

  // SVI
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_closed_at)) {
    nextFei.svi_closed_at = body.svi_closed_at || null;
    if (body.svi_closed_at) nextFei.svi_closed_by_user_id = user.id;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_assigned_at)) {
    nextFei.svi_assigned_at = body.svi_assigned_at || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_entity_id)) {
    nextFei.svi_entity_id = body.svi_entity_id || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_user_id)) {
    nextFei.svi_user_id = body.svi_user_id || null;
  }

  return nextFei;
}

/**
 * Run side effects after FEI save (notifications, webhooks, CRM updates)
 * These should run AFTER the transaction commits
 */
export async function runFeiSideEffects(
  savedFei: FeiPopulated,
  existingFei: FeiPopulated | null,
  body: Prisma.FeiUncheckedCreateInput,
  user: User,
): Promise<void> {
  // Early return if deleted or new FEI
  if (!existingFei) {
    return;
  }

  // Webhook: FEI_APPROBATION_MISE_SUR_LE_MARCHE
  if (
    existingFei.examinateur_initial_date_approbation_mise_sur_le_marche !==
    savedFei.examinateur_initial_date_approbation_mise_sur_le_marche
  ) {
    await sendWebhook(savedFei.examinateur_initial_user_id!, 'FEI_APPROBATION_MISE_SUR_LE_MARCHE', {
      feiNumero: savedFei.numero,
    });
  }

  // CRM: Update Brevo chasseur deal on first FEI treatment
  if (!user.at_least_one_fei_treated) {
    if (user.roles.includes(UserRoles.CHASSEUR)) {
      if (savedFei.examinateur_initial_user_id === user.id) {
        if (savedFei.examinateur_initial_date_approbation_mise_sur_le_marche) {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
              at_least_one_fei_treated: savedFei.examinateur_initial_date_approbation_mise_sur_le_marche,
            },
          });
          await updateBrevoChasseurDeal(updatedUser);
        }
      } else if (savedFei.premier_detenteur_user_id === user.id) {
        if (savedFei.fei_current_owner_user_id !== user.id) {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { at_least_one_fei_treated: savedFei.updated_at },
          });
          await updateBrevoChasseurDeal(updatedUser);
        }
      }
    }
  }

  // CRM: Update ETG deal on transition
  if (
    existingFei.fei_current_owner_role === UserRoles.ETG &&
    savedFei.fei_current_owner_role !== UserRoles.ETG
  ) {
    const etg = await prisma.entity.findUnique({
      where: {
        id: savedFei.fei_current_owner_entity_id!,
        deleted_at: null,
      },
    });
    if (etg?.type === EntityTypes.ETG) {
      if (!etg.at_least_one_fei_treated) {
        await updateBrevoETGDealPremiereFiche(etg);
      }
    }
  }

  // Webhook: FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR
  if (existingFei.fei_current_owner_role !== savedFei.fei_current_owner_role) {
    await sendWebhook(savedFei.fei_current_owner_user_id!, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }

  // Handle SVI assignment
  if (
    existingFei.fei_next_owner_role !== FeiOwnerRole.SVI &&
    savedFei.fei_next_owner_role === FeiOwnerRole.SVI
  ) {
    await handleSviAssignment(savedFei, user);
    return; // Don't process other notifications
  }

  // Handle circuit court assignment
  if (existingFei.fei_next_owner_role !== savedFei.fei_next_owner_role) {
    const isCircuitCourt = (
      [
        FeiOwnerRole.COMMERCE_DE_DETAIL,
        FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
        FeiOwnerRole.CONSOMMATEUR_FINAL,
      ] as Array<FeiOwnerRole>
    ).includes(savedFei.fei_next_owner_role!);
    if (isCircuitCourt) {
      await handleCircuitCourtAssignment(savedFei, body, user);
      return;
    }
  }

  // Handle next owner user change
  const nextOwnerId = body.fei_next_owner_user_id as string;
  if (nextOwnerId && nextOwnerId !== existingFei.fei_next_owner_user_id) {
    await handleNextOwnerUserChange(savedFei, existingFei, nextOwnerId, user);
  }

  // Handle next owner entity change
  if (
    body.fei_next_owner_entity_id &&
    body.fei_next_owner_entity_id !== existingFei.fei_next_owner_entity_id
  ) {
    await handleNextOwnerEntityChange(savedFei, body, user);
  }

  // Handle SVI closure
  if (!existingFei.svi_closed_by_user_id && savedFei.svi_closed_by_user_id) {
    await handleSviClosure(savedFei);
  }

  // Handle intermediaire closure
  if (!existingFei.intermediaire_closed_at && savedFei.intermediaire_closed_at) {
    await handleIntermediaireClosure(savedFei);
  }
}

async function handleSviAssignment(savedFei: FeiPopulated, user: User): Promise<void> {
  const sviUsers = await prisma.user.findMany({
    where: {
      roles: { has: UserRoles.SVI },
      EntityAndUserRelations: {
        some: {
          entity_id: savedFei.svi_entity_id!,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: {
            in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
          },
        },
      },
    },
  });
  for (const sviUser of sviUsers) {
    const [object, email] = await formatSviAssignedEmail(savedFei);

    await sendNotificationToUser({
      user: sviUser,
      title: object,
      body: email,
      email: email,
      notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
    });
  }

  const svi = await prisma.entity.findUnique({
    where: {
      deleted_at: null,
      id: savedFei.fei_current_owner_entity_id!,
    },
  });
  if (svi?.type === EntityTypes.SVI) {
    if (!svi.at_least_one_fei_treated) {
      await updateBrevoSVIDealPremiereFiche(svi);
    }
  }
  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendWebhook(examinateur.id, 'FEI_ASSIGNEE_AU_SVI', { feiNumero: savedFei.numero });
  }
  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendWebhook(premierDetenteur.id, 'FEI_ASSIGNEE_AU_SVI', { feiNumero: savedFei.numero });
  }
}

async function handleCircuitCourtAssignment(
  savedFei: FeiPopulated,
  body: Prisma.FeiUncheckedCreateInput,
  user: User,
): Promise<void> {
  const usersWorkingForEntity = (
    await prisma.entityAndUserRelations.findMany({
      where: {
        entity_id: body.fei_next_owner_entity_id as string,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: {
          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
        },
        deleted_at: null,
      },
      include: {
        UserRelatedWithEntity: {
          select: {
            id: true,
            web_push_tokens: true,
            native_push_tokens: true,
            notifications: true,
            prenom: true,
            nom_de_famille: true,
            email: true,
          },
        },
      },
    })
  ).map((relation) => relation.UserRelatedWithEntity);
  for (const nextOwner of usersWorkingForEntity) {
    if (nextOwner.id !== user.id) {
      const email = [
        `Bonjour,`,
        `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Vous trouverez un résumé en pièce jointe, à conserver pour votre enregistrement.`,
        `Pour consulter la fiche, rendez-vous sur Zacharie avec votre email ${nextOwner.email} : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
        `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
      ].join('\n\n');
      await sendNotificationToUser({
        user: nextOwner as User,
        title: `${user.prenom} ${user.nom_de_famille} vous a attribué une fiche d'examen initial du gibier sauvage n° ${savedFei?.numero}`,
        body: email,
        email: email,
        notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        attachments: [
          {
            content: await getFichePdf(savedFei),
            name: `${savedFei.numero}.pdf`,
          },
        ],
      });
    }
  }
  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendWebhook(examinateur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendWebhook(premierDetenteur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
}

async function handleNextOwnerUserChange(
  savedFei: FeiPopulated,
  existingFei: FeiPopulated,
  nextOwnerId: string,
  user: User,
): Promise<void> {
  if (nextOwnerId !== user.id) {
    const nextOwner = await prisma.user.findUnique({
      where: { id: nextOwnerId },
    });
    const email = [
      `Bonjour,`,
      `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
      `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
      `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
    ].join('\n\n');
    await sendNotificationToUser({
      user: nextOwner!,
      title: `${user.prenom} ${user.nom_de_famille} vous a attribué la fiche ${savedFei?.numero}`,
      body: email,
      email: email,
      notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
    });
  }
  if (existingFei.fei_next_owner_user_id) {
    const exNextOwner = await prisma.user.findUnique({
      where: { id: existingFei.fei_next_owner_user_id },
    });
    const email = [
      `Bonjour,`,
      `${user.prenom} ${user.nom_de_famille} vous avait attribué par erreur la fiche d'examen initial n° ${savedFei?.numero}.`,
      "Cette erreur vient d'être corrigée : vous n'êtes plus destinataire de cette fiche.",
      `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
      `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
    ].join('\n\n');
    await sendNotificationToUser({
      user: exNextOwner!,
      title: `La fiche n° ${savedFei?.numero} ne vous est plus attribuée`,
      body: email,
      email: email,
      notificationLogAction: `FEI_REMOVED_FROM_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
    });
  }
}

async function handleNextOwnerEntityChange(
  savedFei: FeiPopulated,
  body: Prisma.FeiUncheckedCreateInput,
  user: User,
): Promise<void> {
  const usersWorkingForEntity = (
    await prisma.entityAndUserRelations.findMany({
      where: {
        entity_id: body.fei_next_owner_entity_id as string,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: {
          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
        },
        deleted_at: null,
      },
      include: {
        UserRelatedWithEntity: {
          select: {
            id: true,
            web_push_tokens: true,
            native_push_tokens: true,
            notifications: true,
            prenom: true,
            nom_de_famille: true,
            email: true,
          },
        },
      },
    })
  ).map((relation) => relation.UserRelatedWithEntity);
  for (const nextOwner of usersWorkingForEntity) {
    if (nextOwner.id !== user.id) {
      const email = [
        `Bonjour,`,
        `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
        `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
        `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
      ].join('\n\n');
      await sendNotificationToUser({
        user: nextOwner as User,
        title: `${user.prenom} ${user.nom_de_famille} vous a attribué la fiche ${savedFei?.numero}`,
        body: email,
        email: email,
        notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
      });
    }
  }
  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendWebhook(examinateur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendWebhook(premierDetenteur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
}

async function handleSviClosure(savedFei: FeiPopulated): Promise<void> {
  const [object, email] = await formatManualValidationSviEmail(savedFei, savedFei.Carcasses);
  const notification = {
    title: object,
    body: email,
    email: email,
    notificationLogAction: `FEI_AUTO_CLOSED_${savedFei.numero}`,
  };
  if (savedFei.FeiExaminateurInitialUser) {
    const examinateur = savedFei.FeiExaminateurInitialUser;
    if (examinateur) {
      await sendNotificationToUser({
        user: examinateur,
        ...notification,
      });
      await sendWebhook(examinateur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
    }
  }
  if (
    savedFei.FeiPremierDetenteurUser &&
    savedFei.FeiPremierDetenteurUser.id !== savedFei.FeiExaminateurInitialUser?.id
  ) {
    const premierDetenteur = savedFei.FeiPremierDetenteurUser;
    if (premierDetenteur) {
      await sendNotificationToUser({
        user: premierDetenteur,
        ...notification,
      });
      await sendWebhook(premierDetenteur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
    }
  }
}

async function handleIntermediaireClosure(savedFei: FeiPopulated): Promise<void> {
  if (savedFei.FeiExaminateurInitialUser) {
    const examinateur = savedFei.FeiExaminateurInitialUser;
    if (examinateur) {
      await sendWebhook(examinateur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
    }
  }
  if (
    savedFei.FeiPremierDetenteurUser &&
    savedFei.FeiPremierDetenteurUser.id !== savedFei.FeiExaminateurInitialUser?.id
  ) {
    const premierDetenteur = savedFei.FeiPremierDetenteurUser;
    if (premierDetenteur) {
      await sendWebhook(premierDetenteur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
    }
  }
}

router.post(
  '/refresh',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<FeiRefreshResponse>, next: express.NextFunction) => {
      if (!req.user.activated) {
        res.status(400).send({
          ok: false,
          data: { feis: [] },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      let numeros = req.body.numeros;
      if (!numeros.length) {
        res.status(400).send({
          ok: false,
          data: { feis: [] },
          error: 'Le paramètre numeros est obligatoire',
        });
        return;
      }
      const feis = await prisma.fei.findMany({
        where: {
          numero: { in: numeros },
        },
        include: {
          Carcasses: {
            include: {
              CarcasseIntermediaire: true,
            },
          },
          FeiExaminateurInitialUser: true,
          FeiPremierDetenteurUser: true,
          FeiPremierDetenteurEntity: true,
          FeiDepotEntity: true,
          FeiCurrentUser: true,
          FeiCurrentEntity: true,
          FeiNextUser: true,
          FeiNextEntity: true,
          FeiSoustraiteByEntity: true,
          FeiSoustraiteByUser: true,
          FeiSviUser: true,
          FeiSviEntity: true,
          CarcasseIntermediaire: {
            include: {
              CarcasseIntermediaireEntity: true,
              CarcasseIntermediaireUser: true,
            },
            orderBy: [{ prise_en_charge_at: Prisma.SortOrder.desc }, { created_at: Prisma.SortOrder.desc }],
          },
        },
      });

      res.status(200).send({
        ok: true,
        data: {
          feis,
        },
        error: '',
      });
    },
  ),
);

router.post(
  '/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<FeiResponse>, next: express.NextFunction) => {
      const body: Prisma.FeiUncheckedCreateInput = req.body;
      const user = req.user as User;
      const feiNumero = req.params.fei_numero;

      if (!user.activated) {
        res.status(400).send({
          ok: false,
          data: { fei: null },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      if (!feiNumero) {
        res.status(400).send({
          ok: false,
          data: { fei: null },
          error: 'Le numéro de fiche est obligatoire',
        });
        return;
      }

      // Validate context slug if provided
      if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.creation_context)) {
        const contextSlug = body.creation_context;
        if (contextSlug && contextSlug !== 'zacharie') {
          const apiKey = await prisma.apiKey.findFirst({
            where: { slug_for_context: contextSlug },
          });
          if (!apiKey) {
            res.status(400).send({ ok: false, data: { fei: null }, error: 'Invalid context slug' });
            return;
          }
        }
      }

      try {
        const result = await saveFei(feiNumero, body, user);

        // Run side effects after save (notifications, webhooks, CRM)
        if (!result.isDeleted) {
          await runFeiSideEffects(result.savedFei, result.existingFei, body, user);
        }

        res.status(200).send({
          ok: true,
          data: { fei: result.savedFei },
          error: '',
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Seul un examinateur initial peut créer une fiche') {
            capture(new Error('Tentative de hack: seul un examinateur initial peut créer une fiche'), {
              extra: { body, feiNumero },
              user,
            });
            res.status(400).send({ ok: false, data: { fei: null }, error: error.message });
            return;
          }
          if (error.message === 'Fei not found for deletion') {
            res.status(404).send({ ok: false, data: { fei: null }, error: 'Fei not found' });
            return;
          }
          if (error.message === 'Unauthorized to delete') {
            res.status(400).send({ ok: false, data: { fei: null }, error: 'Unauthorized' });
            return;
          }
        }
        throw error;
      }
    },
  ),
);

router.get(
  '/done',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<FeisDoneResponse>, next: express.NextFunction) => {
      const user = req.user!;
      if (!user.activated) {
        res.status(400).send({
          ok: false,
          data: { user: null, feisDone: [] },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      // if (!user.onboarded_at) {
      //   res.status(200).send({
      //     ok: true,
      //     data: {
      //       user: null,
      //       feisDone: [],
      //     },
      //     error: '',
      //   });
      //   return;
      // }

      const feisDone = await prisma.fei.findMany({
        where: {
          deleted_at: null,
          AND: [
            {
              OR: [{ svi_assigned_at: { not: null } }, { intermediaire_closed_at: { not: null } }],
              // OR: [{ automatic_closed_at: { not: null } }, { svi_closed_at: { not: null } }],
            },
            {
              OR: [
                { examinateur_initial_user_id: user.id },
                {
                  premier_detenteur_user_id: user.id,
                },
                {
                  FeiPremierDetenteurEntity: {
                    EntityRelationsWithUsers: {
                      some: {
                        owner_id: user.id,
                        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                        status: {
                          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                        },
                      },
                    },
                  },
                },
                {
                  FeiSoustraiteByEntity: {
                    EntityRelationsWithUsers: {
                      some: {
                        owner_id: user.id,
                        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                        status: {
                          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                        },
                      },
                    },
                  },
                },
                { svi_user_id: user.id },
                {
                  CarcasseIntermediaire: {
                    some: {
                      intermediaire_user_id: user.id,
                    },
                  },
                },
                {
                  CarcasseIntermediaire: {
                    some: {
                      CarcasseIntermediaireEntity: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
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
                {
                  FeiSviEntity: {
                    EntityRelationsWithUsers: {
                      some: {
                        owner_id: user.id,
                        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                        status: {
                          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        // select: feiDoneSelect,
        include: {
          CarcasseIntermediaire: true,
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      res.status(200).send({
        ok: true,
        data: {
          user,
          feisDone: feisDone.sort((a, b) => {
            const aDate =
              a.automatic_closed_at ||
              a.intermediaire_closed_at ||
              a.svi_closed_at ||
              a.examinateur_initial_date_approbation_mise_sur_le_marche;
            const bDate =
              b.automatic_closed_at ||
              b.intermediaire_closed_at ||
              b.svi_closed_at ||
              b.examinateur_initial_date_approbation_mise_sur_le_marche;
            return bDate < aDate ? -1 : 1;
          }),
        },
        error: '',
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { last_seen_at: new Date() },
      });

      return;
    },
  ),
);

router.get(
  '/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<FeiResponse>, next: express.NextFunction) => {
      if (!req.user.activated) {
        res.status(400).send({
          ok: false,
          data: { fei: null },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      const fei = await prisma.fei.findUnique({
        where: {
          numero: req.params.fei_numero,
        },
        include: {
          Carcasses: {
            include: {
              CarcasseIntermediaire: true,
            },
          },
          FeiExaminateurInitialUser: true,
          FeiPremierDetenteurUser: true,
          FeiPremierDetenteurEntity: true,
          FeiDepotEntity: true,
          FeiCurrentUser: true,
          FeiCurrentEntity: true,
          FeiNextUser: true,
          FeiNextEntity: true,
          FeiSoustraiteByEntity: true,
          FeiSoustraiteByUser: true,
          FeiSviUser: true,
          FeiSviEntity: true,
          CarcasseIntermediaire: {
            include: {
              CarcasseIntermediaireEntity: true,
              CarcasseIntermediaireUser: true,
            },
            orderBy: [{ prise_en_charge_at: Prisma.SortOrder.desc }, { created_at: Prisma.SortOrder.desc }],
          },
        },
      });

      if (!fei) {
        res.status(404).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }

      res.status(200).send({
        ok: true,
        data: {
          fei,
        },
        error: '',
      });
    },
  ),
);

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: express.Request, res: express.Response<FeisResponse>, next: express.NextFunction) => {
      const user = req.user!;
      if (!req.user.activated) {
        res.status(400).send({
          ok: false,
          data: { user: req.user, feisUnderMyResponsability: [], feisToTake: [], feisOngoing: [] },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      // if (!user?.onboarded_at) {
      //   res.status(200).send({
      //     ok: true,
      //     data: {
      //       user: null,
      //       feisUnderMyResponsability: [],
      //       feisToTake: [],
      //       feisOngoing: [],
      //       feisDone: [],
      //     },
      //     error: 'Not onboarded',
      //   });
      //   return;
      // }
      const feisUnderMyResponsability = await prisma.fei.findMany({
        where: {
          // deleted_at: null,
          automatic_closed_at: null,
          svi_closed_at: null,
          fei_next_owner_user_id: null,
          fei_next_owner_entity_id: null,
          svi_assigned_at: null,
          intermediaire_closed_at: null,
          OR: [
            // Case 1: I am the current owner of the FEI
            {
              fei_current_owner_user_id: user.id,
            },
            // Case 2: I work for the current owner entity.
            {
              FeiCurrentEntity: {
                EntityRelationsWithUsers: {
                  some: {
                    owner_id: user.id,
                    relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                    status: {
                      in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                    },
                  },
                },
              },
            },
          ],
        },
        include: {
          CarcasseIntermediaire: true,
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      const feisToTake = await prisma.fei.findMany({
        where: {
          // deleted_at: null,
          numero: { notIn: feisUnderMyResponsability.map((fei) => fei.numero) },
          svi_assigned_at: null,
          intermediaire_closed_at: null,
          OR: [
            // If the user is directly set as the next owner
            { fei_next_owner_user_id: user.id },
            // Or if the user works for the next owner entity directly (for non-ETG next owners)
            {
              FeiNextEntity: {
                EntityRelationsWithUsers: {
                  some: {
                    owner_id: user.id,
                    relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                    status: {
                      in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                    },
                  },
                },
              },
            },
          ],
        },
        include: {
          CarcasseIntermediaire: true,
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      const feisOngoing = await prisma.fei.findMany({
        where: {
          // deleted_at: null,
          svi_assigned_at: null,
          intermediaire_closed_at: null,
          numero: {
            notIn: [
              ...feisUnderMyResponsability.map((fei) => fei.numero),
              ...feisToTake.map((fei) => fei.numero),
            ],
          },
          // fei_current_owner_user_id: { not: user.id },
          AND: [
            // {
            //   AND: [
            //     {
            //       fei_next_owner_user_id: { not: user.id },
            //     },
            //     // {
            //     //   fei_next_owner_user_id: { not: null },
            //     // },
            //   ],
            // },
            // {
            //   OR: [
            //     { fei_next_owner_entity_id: null },
            //     {
            //       FeiNextEntity: {
            //         EntityRelationsWithUsers: {
            //           none: {
            //             owner_id: user.id,
            //             relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            //             status: {
            //               in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
            //             },
            //           },
            //         },
            //       },
            //     },
            //   ],
            // },
            {
              OR: [
                {
                  examinateur_initial_user_id: user.id,
                },
                {
                  premier_detenteur_user_id: user.id,
                },
                {
                  FeiPremierDetenteurEntity: {
                    EntityRelationsWithUsers: {
                      some: {
                        owner_id: user.id,
                        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                        status: {
                          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                        },
                      },
                    },
                  },
                },
                {
                  FeiSoustraiteByEntity: {
                    EntityRelationsWithUsers: {
                      some: {
                        owner_id: user.id,
                        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                        status: {
                          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                        },
                      },
                    },
                  },
                },
                {
                  CarcasseIntermediaire: {
                    some: {
                      intermediaire_user_id: user.id,
                    },
                  },
                },
                {
                  CarcasseIntermediaire: {
                    some: {
                      CarcasseIntermediaireEntity: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
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
              ],
            },
          ],
        },
        include: {
          CarcasseIntermediaire: true,
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      res.status(200).send({
        ok: true,
        data: {
          user,
          feisUnderMyResponsability,
          feisToTake,
          feisOngoing,
        },
        error: '',
      });
    },
  ),
);

export default router;
