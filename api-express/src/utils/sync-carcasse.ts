import prisma from '~/prisma';

import {
  Carcasse,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
  CarcasseStatus,
  EntityRelationType,
  Fei,
  FeiOwnerRole,
  IPM1Decision,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
import dayjs from 'dayjs';
import { TRICHINE_FEATURE_ENABLED } from '~/config';
import type { SyncScope } from '~/utils/sync-scope';
import { isCarcassePriseEnChargeEnAval } from '~/utils/carcasse-prise-en-charge';
import { SyncRejectedError } from '~/utils/sync-errors';
import { assertNoNewDeletedEntity } from '~/utils/deleted-entities';
import { carcasseHasResultatTrichineNegatif, TRICHINE_ESPECE_CONCERNEE } from '~/utils/trichine';
import { isStaleWrite, nextVersion } from '~/utils/sync-version';
import { isAllowedPremierDetenteurUserId } from '~/utils/premier-detenteur-user-id';
import { capture } from '~/third-parties/sentry';

export interface SaveCarcasseResult {
  savedCarcasse: Carcasse;
  existingCarcasse: Carcasse;
  isDeleted: boolean;
}

interface SyncCarcasseOpts {
  existingFei?: Fei | null;
  existingCarcasse?: Carcasse | null;
  ensuredRelations?: Map<string, Promise<void>>;
  deletedEntityIds?: Set<string>;
}

export async function syncCarcasse(
  fei_numero: string,
  zacharie_carcasse_id: string,
  body: Prisma.CarcasseUncheckedCreateInput,
  user: User,
  scope: SyncScope,
  opts: SyncCarcasseOpts = {}
): Promise<SaveCarcasseResult> {
  if (!fei_numero) {
    throw new Error('Le numéro de fiche est obligatoire');
  }
  const existingFei =
    opts.existingFei !== undefined
      ? opts.existingFei
      : await prisma.fei.findUnique({
          where: { numero: fei_numero },
        });
  if (!existingFei) {
    throw new Error('Fiche non trouvée');
  }
  if (!zacharie_carcasse_id) {
    throw new Error('Le numéro de la carcasse est obligatoire');
  }
  if (!user.activated) {
    const transmitsToNextDetenteur =
      !!body.next_owner_role &&
      body.next_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
      body.next_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL;
    if (transmitsToNextDetenteur) {
      throw new Error('Votre compte doit être validé avant de pouvoir transmettre une fiche');
    }
  }
  let existingCarcasse =
    opts.existingCarcasse !== undefined
      ? opts.existingCarcasse
      : await prisma.carcasse.findFirst({
          where: {
            zacharie_carcasse_id: zacharie_carcasse_id,
            fei_numero: fei_numero,
          },
        });
  if (existingCarcasse) {
    if (existingCarcasse.fei_numero !== fei_numero) {
      throw new SyncRejectedError("Cette carcasse n'appartient pas à cette fiche");
    }
    if (!(await scope.canWriteCarcasse(existingCarcasse.zacharie_carcasse_id))) {
      throw new SyncRejectedError("Vous n'avez pas accès à cette carcasse");
    }
    if (isStaleWrite(existingCarcasse, body.version, user)) {
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id },
        data: { updated_at: new Date() },
      });
      throw new SyncRejectedError('Version obsolète');
    }
  } else if (!(await scope.canWriteFei(existingFei))) {
    throw new SyncRejectedError("Vous n'avez pas accès à cette fiche");
  }

  const isJustCreated = !existingCarcasse;
  if (!existingCarcasse) {
    const numeroBracelet = body.numero_bracelet;
    if (!numeroBracelet) {
      throw new Error('Le numéro de marquage est obligatoire');
    }

    try {
      existingCarcasse = await prisma.carcasse.create({
        data: {
          zacharie_carcasse_id,
          fei_numero,
          numero_bracelet: body.numero_bracelet,
          created_by_user_id: user.id,
          created_at: body.created_at ?? undefined,
          is_synced: true,
        },
      });
    } catch (error) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isUniqueViolation) throw error;
      existingCarcasse = await prisma.carcasse.findUnique({ where: { zacharie_carcasse_id } });
      if (!existingCarcasse) throw error;
      if (existingCarcasse.fei_numero !== fei_numero) {
        throw new SyncRejectedError("Cette carcasse n'appartient pas à cette fiche");
      }
    }
    scope.grant(zacharie_carcasse_id);
  }

  const canWriteOwnership = scope.isFeiOwner(existingFei);

  const isExaminateur = existingFei.examinateur_initial_user_id === user.id;
  const isPremierDetenteur = scope.isPremierDetenteur(existingFei);
  const canWriteApprobationExaminateur = canWriteOwnership || isPremierDetenteur;
  const isCreator = existingCarcasse.created_by_user_id === user.id;
  const canWriteIdentity = isExaminateur || isCreator;
  const isSvi = user.roles.includes(UserRoles.SVI);
  function isUserOrEntityOfUser(userId: string | null, entityId: string | null): boolean {
    return (!!userId && userId === user.id) || (!!entityId && scope.entityIds.includes(entityId));
  }
  const isChezLesChasseurs =
    !existingCarcasse.current_owner_role ||
    existingCarcasse.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL ||
    existingCarcasse.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR;
  const canWriteTransmission =
    isJustCreated ||
    isUserOrEntityOfUser(existingCarcasse.current_owner_user_id, existingCarcasse.current_owner_entity_id) ||
    isUserOrEntityOfUser(existingCarcasse.next_owner_user_id, existingCarcasse.next_owner_entity_id) ||
    (isChezLesChasseurs && canWriteApprobationExaminateur);
  let ownsExistingDecision: boolean | undefined;
  async function canWriteDecisionIntermediaire(): Promise<boolean> {
    if (!canWriteTransmission) return false;
    const refusIntermediaireId = existingCarcasse!.intermediaire_carcasse_refus_intermediaire_id;
    if (!refusIntermediaireId) return true;
    if (ownsExistingDecision === undefined) {
      const line = await prisma.carcasseIntermediaire.findFirst({
        where: {
          zacharie_carcasse_id: existingCarcasse!.zacharie_carcasse_id,
          intermediaire_id: refusIntermediaireId,
        },
        select: { intermediaire_entity_id: true },
      });
      ownsExistingDecision = !!line && scope.entityIds.includes(line.intermediaire_entity_id);
    }
    return ownsExistingDecision;
  }
  const decisionFields = [
    Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante,
    Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id,
    Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif,
  ] as const;
  const changesDecision = decisionFields.some((field) => {
    if (!body.hasOwnProperty(field)) return false;
    if (field === Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante) {
      return !!body[field] !== !!existingCarcasse!.intermediaire_carcasse_manquante;
    }
    return (body[field] ?? null) !== (existingCarcasse![field] ?? null);
  });
  const canWriteDecision = changesDecision ? await canWriteDecisionIntermediaire() : true;

  if (body.deleted_at) {
    const canDelete =
      isExaminateur || isPremierDetenteur
        ? !isCarcassePriseEnChargeEnAval(existingCarcasse)
        : isCreator && (await canCreatorCancelCarcasse(existingCarcasse, isJustCreated, user));
    if (!canDelete) {
      throw new SyncRejectedError('Vous ne pouvez pas supprimer cette carcasse');
    }
    const deletedCarcasse = await prisma.carcasse.update({
      where: {
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
      },
      data: {
        deleted_at: body.deleted_at,
        is_synced: true,
        ...nextVersion(user.id),
      },
    });
    await prisma.carcasseIntermediaire.updateMany({
      where: { zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id },
      data: { deleted_at: body.deleted_at, ...nextVersion(user.id) },
    });
    return { savedCarcasse: deletedCarcasse, existingCarcasse, isDeleted: true };
  }

  await assertNoNewDeletedEntity(
    body,
    existingCarcasse,
    [
      'next_owner_entity_id',
      ...(isPremierDetenteur ? (['premier_detenteur_depot_entity_id'] as const) : []),
      ...(canWriteOwnership ? (['premier_detenteur_entity_id'] as const) : []),
    ],
    opts.deletedEntityIds
  );

  const nextCarcasse: Prisma.CarcasseUncheckedUpdateInput = {
    is_synced: true,
  };

  function actorUserId(field: keyof Carcasse): string | null | undefined {
    const value = body[field as keyof typeof body] as string | null | undefined;
    if (!value || value === existingCarcasse![field]) return value;
    return user.id;
  }
  function isAllowedActorEntityId(field: keyof Carcasse): boolean {
    const value = body[field as keyof typeof body] as string | null | undefined;
    return !value || value === existingCarcasse![field] || scope.entityIds.includes(value);
  }

  if (canWriteIdentity && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.numero_bracelet)) {
    nextCarcasse.numero_bracelet = body.numero_bracelet;
  }
  if (canWriteIdentity && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_evisceration)) {
    nextCarcasse.heure_evisceration = body.heure_evisceration;
  }
  if (canWriteIdentity && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.type)) {
    nextCarcasse.type = body[Prisma.CarcasseScalarFieldEnum.type];
  }
  if (canWriteIdentity && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.date_mise_a_mort)) {
    nextCarcasse.date_mise_a_mort = body.date_mise_a_mort;
  }
  if (canWriteIdentity && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.nombre_d_animaux)) {
    nextCarcasse.nombre_d_animaux = Number(body[Prisma.CarcasseScalarFieldEnum.nombre_d_animaux]);
  }
  if (canWriteIdentity && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort)) {
    nextCarcasse.heure_mise_a_mort = body[Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort];
  }
  if (
    canWriteIdentity &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort_premiere_carcasse_fei)
  ) {
    nextCarcasse.heure_mise_a_mort_premiere_carcasse_fei =
      body[Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort_premiere_carcasse_fei];
  }
  if (
    isPremierDetenteur &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.consommateur_final_usage_domestique)
  ) {
    nextCarcasse.consommateur_final_usage_domestique =
      body[Prisma.CarcasseScalarFieldEnum.consommateur_final_usage_domestique];
  }
  if (
    canWriteIdentity &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_evisceration_derniere_carcasse_fei)
  ) {
    nextCarcasse.heure_evisceration_derniere_carcasse_fei =
      body[Prisma.CarcasseScalarFieldEnum.heure_evisceration_derniere_carcasse_fei];
  }
  if (canWriteIdentity && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.espece)) {
    nextCarcasse.espece = body[Prisma.CarcasseScalarFieldEnum.espece];
  }
  if (
    isExaminateur &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie)
  ) {
    const nextValue = body[Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie];
    nextCarcasse.examinateur_carcasse_sans_anomalie = nextValue;
    if (nextValue === true) {
      nextCarcasse.examinateur_anomalies_carcasse = [];
      nextCarcasse.examinateur_anomalies_abats = [];
    }
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_initial_offline)) {
    nextCarcasse.examinateur_initial_offline = isExaminateur
      ? body[Prisma.CarcasseScalarFieldEnum.examinateur_initial_offline]
      : existingFei.examinateur_initial_offline;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_initial_user_id)) {
    nextCarcasse.examinateur_initial_user_id = existingFei.examinateur_initial_user_id;
  }
  if (
    canWriteApprobationExaminateur &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche)
  ) {
    nextCarcasse.examinateur_initial_approbation_mise_sur_le_marche =
      body[Prisma.CarcasseScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche];
  }
  if (
    canWriteApprobationExaminateur &&
    body.hasOwnProperty(
      Prisma.CarcasseScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche
    )
  ) {
    nextCarcasse.examinateur_initial_date_approbation_mise_sur_le_marche =
      body[Prisma.CarcasseScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche];
  }
  if (isExaminateur && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)) {
    const anomaliesCarcasses = (body.examinateur_anomalies_carcasse as string[]) || [];
    nextCarcasse.examinateur_anomalies_carcasse = anomaliesCarcasses.filter(Boolean);
  }
  if (isExaminateur && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)) {
    const anomaliesAbats = (body.examinateur_anomalies_abats as string[]) || [];
    nextCarcasse.examinateur_anomalies_abats = anomaliesAbats.filter(Boolean);
  }
  if (isExaminateur && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_commentaire)) {
    nextCarcasse.examinateur_commentaire = body[Prisma.CarcasseScalarFieldEnum.examinateur_commentaire];
  }
  if (isExaminateur && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at)) {
    nextCarcasse.examinateur_signed_at = body.examinateur_signed_at;
  }
  const canWritePremierDetenteurChoice = (value: unknown) => isPremierDetenteur || value == null;
  if (
    canWritePremierDetenteurChoice(body.premier_detenteur_depot_entity_id) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_id)
  ) {
    nextCarcasse.premier_detenteur_depot_entity_id = body.premier_detenteur_depot_entity_id || null;
  }
  if (
    canWritePremierDetenteurChoice(body.premier_detenteur_depot_entity_name_cache) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_entity_name_cache)
  ) {
    nextCarcasse.premier_detenteur_depot_entity_name_cache =
      body.premier_detenteur_depot_entity_name_cache || null;
  }
  if (
    canWritePremierDetenteurChoice(body.premier_detenteur_depot_type) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_type)
  ) {
    nextCarcasse.premier_detenteur_depot_type = body.premier_detenteur_depot_type || null;
  }
  if (
    canWritePremierDetenteurChoice(body.premier_detenteur_depot_ccg_at) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_depot_ccg_at)
  ) {
    nextCarcasse.premier_detenteur_depot_ccg_at = body.premier_detenteur_depot_ccg_at || null;
  }
  if (
    canWritePremierDetenteurChoice(body.premier_detenteur_transport_type) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_transport_type)
  ) {
    nextCarcasse.premier_detenteur_transport_type = body.premier_detenteur_transport_type || null;
  }
  if (
    canWritePremierDetenteurChoice(body.premier_detenteur_transport_date) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_transport_date)
  ) {
    nextCarcasse.premier_detenteur_transport_date = body.premier_detenteur_transport_date || null;
  }
  if (
    isPremierDetenteur &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_role_cache)
  ) {
    nextCarcasse.premier_detenteur_prochain_detenteur_role_cache =
      body.premier_detenteur_prochain_detenteur_role_cache || null;
  }
  if (
    isPremierDetenteur &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache)
  ) {
    nextCarcasse.premier_detenteur_prochain_detenteur_id_cache =
      body.premier_detenteur_prochain_detenteur_id_cache || null;
  }
  if (isJustCreated && !canWriteOwnership && !isPremierDetenteur && scope.carcasseAccessWhere) {
    const carcasseSoeur = await prisma.carcasse.findFirst({
      where: {
        AND: [
          {
            fei_numero,
            deleted_at: null,
            NOT: { zacharie_carcasse_id },
            premier_detenteur_prochain_detenteur_id_cache: { not: null },
          },
          scope.carcasseAccessWhere,
        ],
      },
      orderBy: { created_at: 'asc' },
      select: {
        premier_detenteur_depot_entity_id: true,
        premier_detenteur_depot_entity_name_cache: true,
        premier_detenteur_depot_type: true,
        premier_detenteur_depot_ccg_at: true,
        premier_detenteur_transport_type: true,
        premier_detenteur_transport_date: true,
        premier_detenteur_prochain_detenteur_role_cache: true,
        premier_detenteur_prochain_detenteur_id_cache: true,
      },
    });
    if (carcasseSoeur) Object.assign(nextCarcasse, carcasseSoeur);
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_offline)) {
    nextCarcasse.premier_detenteur_offline = canWriteApprobationExaminateur
      ? body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_offline]
      : existingFei.premier_detenteur_offline;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_user_id)) {
    const value = body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_user_id];
    nextCarcasse.premier_detenteur_user_id =
      canWriteOwnership &&
      (await isAllowedPremierDetenteurUserId(
        value,
        [existingFei.premier_detenteur_user_id, existingCarcasse.premier_detenteur_user_id],
        user
      ))
        ? value
        : existingFei.premier_detenteur_user_id;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_entity_id)) {
    nextCarcasse.premier_detenteur_entity_id = canWriteOwnership
      ? body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_entity_id]
      : existingFei.premier_detenteur_entity_id;
  }
  if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.premier_detenteur_name_cache)) {
    nextCarcasse.premier_detenteur_name_cache = canWriteOwnership
      ? body[Prisma.CarcasseScalarFieldEnum.premier_detenteur_name_cache]
      : existingFei.premier_detenteur_name_cache;
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_closed_at)) {
    nextCarcasse.intermediaire_closed_at = body[Prisma.CarcasseScalarFieldEnum.intermediaire_closed_at];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_user_id)
  ) {
    nextCarcasse.intermediaire_closed_by_user_id = actorUserId(
      Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_user_id
    );
  }
  if (
    canWriteTransmission &&
    isAllowedActorEntityId(Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_entity_id) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_entity_id)
  ) {
    nextCarcasse.intermediaire_closed_by_entity_id =
      body[Prisma.CarcasseScalarFieldEnum.intermediaire_closed_by_entity_id];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_user_id)
  ) {
    nextCarcasse.latest_intermediaire_user_id = actorUserId(
      Prisma.CarcasseScalarFieldEnum.latest_intermediaire_user_id
    );
  }
  if (
    canWriteTransmission &&
    isAllowedActorEntityId(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_entity_id) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_entity_id)
  ) {
    nextCarcasse.latest_intermediaire_entity_id =
      body[Prisma.CarcasseScalarFieldEnum.latest_intermediaire_entity_id];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_name_cache)
  ) {
    nextCarcasse.latest_intermediaire_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.latest_intermediaire_name_cache];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_assigned_at)) {
    nextCarcasse.svi_assigned_at = await getSviAssignedAt(
      body[Prisma.CarcasseScalarFieldEnum.svi_assigned_at],
      existingCarcasse
    );
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_entity_id)) {
    nextCarcasse.svi_entity_id = body[Prisma.CarcasseScalarFieldEnum.svi_entity_id];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_user_id)) {
    nextCarcasse.current_owner_user_id = body[Prisma.CarcasseScalarFieldEnum.current_owner_user_id];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_user_name_cache)
  ) {
    nextCarcasse.current_owner_user_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.current_owner_user_name_cache];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_entity_id)) {
    nextCarcasse.current_owner_entity_id = body[Prisma.CarcasseScalarFieldEnum.current_owner_entity_id];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_entity_name_cache)
  ) {
    nextCarcasse.current_owner_entity_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.current_owner_entity_name_cache];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.current_owner_role)) {
    nextCarcasse.current_owner_role = body[Prisma.CarcasseScalarFieldEnum.current_owner_role];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_wants_to_sous_traite)
  ) {
    nextCarcasse.next_owner_wants_to_sous_traite =
      body[Prisma.CarcasseScalarFieldEnum.next_owner_wants_to_sous_traite];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_at)) {
    nextCarcasse.next_owner_sous_traite_at = body[Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_at];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_user_id)
  ) {
    nextCarcasse.next_owner_sous_traite_by_user_id = actorUserId(
      Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_user_id
    );
  }
  if (
    canWriteTransmission &&
    isAllowedActorEntityId(Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_entity_id) &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_entity_id)
  ) {
    nextCarcasse.next_owner_sous_traite_by_entity_id =
      body[Prisma.CarcasseScalarFieldEnum.next_owner_sous_traite_by_entity_id];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_user_id)) {
    nextCarcasse.next_owner_user_id = body[Prisma.CarcasseScalarFieldEnum.next_owner_user_id];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_user_name_cache)
  ) {
    nextCarcasse.next_owner_user_name_cache = body[Prisma.CarcasseScalarFieldEnum.next_owner_user_name_cache];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_entity_id)) {
    nextCarcasse.next_owner_entity_id = body[Prisma.CarcasseScalarFieldEnum.next_owner_entity_id];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_entity_name_cache)
  ) {
    nextCarcasse.next_owner_entity_name_cache =
      body[Prisma.CarcasseScalarFieldEnum.next_owner_entity_name_cache];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_role)) {
    nextCarcasse.next_owner_role = body[Prisma.CarcasseScalarFieldEnum.next_owner_role];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.prev_owner_user_id)) {
    nextCarcasse.prev_owner_user_id = body[Prisma.CarcasseScalarFieldEnum.prev_owner_user_id];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.prev_owner_entity_id)) {
    nextCarcasse.prev_owner_entity_id = body[Prisma.CarcasseScalarFieldEnum.prev_owner_entity_id];
  }
  if (canWriteTransmission && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.prev_owner_role)) {
    nextCarcasse.prev_owner_role = body[Prisma.CarcasseScalarFieldEnum.prev_owner_role];
  }
  if (
    canWriteTransmission &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_signed_at)
  ) {
    nextCarcasse.latest_intermediaire_signed_at = body.latest_intermediaire_signed_at;
  }
  if (
    canWriteDecision &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante)
  ) {
    const nextValue = body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante];
    nextCarcasse.intermediaire_carcasse_manquante = nextValue;
  }
  if (
    canWriteDecision &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id)
  ) {
    nextCarcasse.intermediaire_carcasse_refus_intermediaire_id =
      body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id];
  }
  if (
    canWriteDecision &&
    body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif)
  ) {
    nextCarcasse.intermediaire_carcasse_refus_motif =
      body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif];
  }
  const nextStatus = body.svi_carcasse_status;
  const changesStatus = nextStatus !== undefined && nextStatus !== existingCarcasse.svi_carcasse_status;
  const leavesDecisionIntermediaire =
    changesStatus &&
    (existingCarcasse.svi_carcasse_status === CarcasseStatus.REFUS_ETG_COLLECTEUR ||
      existingCarcasse.svi_carcasse_status === CarcasseStatus.MANQUANTE_ETG_COLLECTEUR);
  const canWriteStatus =
    isSvi ||
    (canNonSviWriteStatus(existingCarcasse, nextStatus) &&
      (!changesStatus || canWriteTransmission) &&
      (!leavesDecisionIntermediaire || (await canWriteDecisionIntermediaire())));
  if (canWriteStatus && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status)) {
    nextCarcasse.svi_carcasse_status = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status];
  }
  if (canWriteStatus && body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at)) {
    nextCarcasse.svi_carcasse_status_set_at = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at];
  }

  if (user.roles.includes(UserRoles.SVI)) {
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_user_id)) {
      nextCarcasse.svi_user_id = actorUserId(Prisma.CarcasseScalarFieldEnum.svi_user_id);
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_closed_at)) {
      nextCarcasse.svi_closed_at = body[Prisma.CarcasseScalarFieldEnum.svi_closed_at];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_closed_by_user_id)) {
      nextCarcasse.svi_closed_by_user_id = actorUserId(Prisma.CarcasseScalarFieldEnum.svi_closed_by_user_id);
    }
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
      nextCarcasse.svi_ipm1_user_id = actorUserId(Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_id);
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
      const nextDecision = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_decision];
      const espece = nextCarcasse.espece ?? existingCarcasse.espece;
      if (
        TRICHINE_FEATURE_ENABLED &&
        nextDecision === IPM1Decision.ACCEPTE &&
        existingCarcasse.svi_ipm1_decision !== IPM1Decision.ACCEPTE &&
        espece === TRICHINE_ESPECE_CONCERNEE
      ) {
        if (!(await carcasseHasResultatTrichineNegatif(zacharie_carcasse_id))) {
          throw new Error(
            "Recherche de trichine obligatoire avant acceptation : aucun résultat négatif n'est associé à cette carcasse de sanglier"
          );
        }
      }
      nextCarcasse.svi_ipm1_decision = nextDecision;
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
      nextCarcasse.svi_ipm2_user_id = actorUserId(Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_id);
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
    data: { ...nextCarcasse, ...nextVersion(user.id) },
  });

  const nextOwnerEntityId = nextCarcasse.next_owner_entity_id as string | null | undefined;
  if (nextOwnerEntityId && nextOwnerEntityId !== existingCarcasse.next_owner_entity_id) {
    await ensureCanTransmitRelation(user, nextOwnerEntityId, opts.ensuredRelations);
  }

  return { savedCarcasse: updatedCarcasse, existingCarcasse, isDeleted: false };
}

function ensureCanTransmitRelation(
  user: User,
  entityId: string,
  ensuredRelations?: Map<string, Promise<void>>
): Promise<void> {
  const pending = ensuredRelations?.get(entityId);
  if (pending) return pending;
  const promise = (async () => {
    const relation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
      entity_id: entityId,
      owner_id: user.id,
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      deleted_at: null,
    };
    try {
      const existingRelation = await prisma.entityAndUserRelations.findFirst({ where: relation });
      if (!existingRelation) {
        await prisma.entityAndUserRelations.create({ data: relation });
      }
    } catch (error) {
      capture(error as Error, { extra: { entityId, userId: user.id, context: 'ensure_relation' }, user });
    }
  })();
  ensuredRelations?.set(entityId, promise);
  return promise;
}

async function canCreatorCancelCarcasse(carcasse: Carcasse, isJustCreated: boolean, user: User) {
  if (
    carcasse.svi_ipm1_signed_at ||
    carcasse.svi_ipm2_signed_at ||
    carcasse.svi_closed_at ||
    carcasse.svi_automatic_closed_at
  ) {
    return false;
  }
  if (isJustCreated) return true;
  const pendingRequests = await prisma.carcasseModificationRequest.count({
    where: {
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      type: CarcasseModificationRequestType.NEW_CARCASSE,
      status: CarcasseModificationRequestStatus.PENDING,
      requested_by_user_id: user.id,
      deleted_at: null,
    },
  });
  return pendingRequests > 0;
}

const SVI_ASSIGNED_AT_MAX_DELAY_HOURS = 48;

async function getSviAssignedAt(
  value: Prisma.CarcasseUncheckedCreateInput['svi_assigned_at'],
  existingCarcasse: Carcasse
): Promise<Prisma.CarcasseUncheckedCreateInput['svi_assigned_at']> {
  if (!value) return null;
  const assignedAt = dayjs(value);
  if (!assignedAt.isValid()) return new Date();
  if (dayjs().diff(assignedAt, 'hour', true) <= SVI_ASSIGNED_AT_MAX_DELAY_HOURS) return value;
  if (existingCarcasse.svi_assigned_at && assignedAt.isSame(existingCarcasse.svi_assigned_at)) return value;
  const carcasseSoeur = await prisma.carcasse.findFirst({
    where: {
      fei_numero: existingCarcasse.fei_numero,
      svi_assigned_at: assignedAt.toDate(),
      deleted_at: null,
    },
    select: { zacharie_carcasse_id: true },
  });
  return carcasseSoeur ? value : new Date();
}

const NON_SVI_STATUSES: Array<CarcasseStatus> = [
  CarcasseStatus.SANS_DECISION,
  CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
  CarcasseStatus.REFUS_ETG_COLLECTEUR,
];

function canNonSviWriteStatus(existing: Carcasse, next: CarcasseStatus | null | undefined): boolean {
  if (next === undefined || next === existing.svi_carcasse_status) return true;
  const isSviInspected = !!existing.svi_ipm1_date || !!existing.svi_ipm2_date;
  if (
    existing.svi_carcasse_status === CarcasseStatus.ACCEPTE &&
    !isSviInspected &&
    (next === CarcasseStatus.MANQUANTE_ETG_COLLECTEUR || next === CarcasseStatus.REFUS_ETG_COLLECTEUR)
  ) {
    return true;
  }
  if (existing.svi_carcasse_status && !NON_SVI_STATUSES.includes(existing.svi_carcasse_status)) return false;
  if (next && NON_SVI_STATUSES.includes(next)) return true;
  return (
    next === CarcasseStatus.ACCEPTE &&
    !isSviInspected &&
    !!existing.svi_assigned_at &&
    dayjs().diff(dayjs(existing.svi_assigned_at), 'day') >= 10
  );
}
