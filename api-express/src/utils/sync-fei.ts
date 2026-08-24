import prisma from '~/prisma';
import { sanitize } from '~/utils/sanitize';
import { Fei, Prisma, User, UserRoles } from '@prisma/client';
import { capture } from '~/third-parties/sentry';
import { z } from 'zod';
import type { SyncScope } from '~/utils/sync-scope';
import { SyncRejectedError } from '~/utils/sync-errors';

export interface SaveFeiResult {
  savedFei: Fei;
  existingFei: Fei | null;
  isDeleted: boolean;
}

const feiBodyZodSchema = z.object({
  date_mise_a_mort: z.string().optional().nullable(),
  commune_mise_a_mort: z.string().optional().nullable(),
  heure_mise_a_mort_premiere_carcasse: z.string().optional().nullable(),
  heure_evisceration_derniere_carcasse: z.string().optional().nullable(),
  created_by_user_id: z.string().optional().nullable(),
  creation_context: z.string().optional().nullable(),
  resume_nombre_de_carcasses: z.string().optional().nullable(),
  examinateur_initial_offline: z.boolean().optional().nullable(),
  examinateur_initial_user_id: z.string().optional().nullable(),
  examinateur_initial_approbation_mise_sur_le_marche: z.boolean().optional().nullable(),
  examinateur_initial_date_approbation_mise_sur_le_marche: z.string().optional().nullable(),
  consommateur_final_usage_domestique: z.string().optional().nullable(),
  premier_detenteur_offline: z.boolean().optional().nullable(),
  premier_detenteur_user_id: z.string().optional().nullable(),
  premier_detenteur_entity_id: z.string().optional().nullable(),
  premier_detenteur_name_cache: z.string().optional().nullable(),
});

export async function syncFei(
  numero: string,
  body: Prisma.FeiUncheckedCreateInput,
  user: User,
  scope: SyncScope
): Promise<SaveFeiResult> {
  let result = feiBodyZodSchema.safeParse(body);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  let existingFei = await prisma.fei.findUnique({
    where: { numero },
  });

  if (!existingFei) {
    // Un chasseur formé (numéro CFEI) peut créer une fiche même si son compte n'est pas
    // encore activé : il peut la préparer, mais pas la transmettre (voir gate ci-dessous).
    const isExaminateurInitial = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
    if (!isExaminateurInitial) {
      capture(new Error('Tentative de hack: seul un examinateur initial peut créer une fiche'), {
        extra: {
          body: body,
          feiNumero: numero,
        },
        user,
      });
      throw new SyncRejectedError('Seul un examinateur initial peut créer une fiche');
    }
  }

  if (existingFei?.deleted_at) {
    return { savedFei: existingFei, existingFei, isDeleted: true };
  }

  if (body.deleted_at) {
    if (!existingFei) {
      throw new Error('Fei not found');
    }
    const canDelete =
      user.isZacharieAdmin ||
      (user.roles.includes(UserRoles.CHASSEUR) && existingFei.examinateur_initial_user_id === user.id);
    if (!canDelete) {
      throw new SyncRejectedError('Unauthorized');
    }
    const deletedFei = await prisma.fei.update({
      where: { numero },
      data: { deleted_at: body.deleted_at },
    });
    await prisma.carcasse.updateMany({
      where: { fei_numero: numero },
      data: { deleted_at: body.deleted_at },
    });
    await prisma.carcasseIntermediaire.updateMany({
      where: { fei_numero: numero },
      data: { deleted_at: body.deleted_at },
    });
    return { savedFei: deletedFei, existingFei, isDeleted: true };
  }

  // Deny by default : jusqu'ici seules la création et la suppression étaient gardées, n'importe
  // quel compte activé pouvait écraser les champs d'une fiche tierce en connaissant son numéro.
  if (existingFei && !(await scope.canWriteFei(existingFei))) {
    throw new SyncRejectedError("Vous n'avez pas accès à cette fiche");
  }

  // Les colonnes de rattachement (créateur, examinateur initial, premier détenteur) sont celles sur
  // lesquelles `canWriteFei` accorde l'écriture : un détenteur aval, qui n'accède à la fiche que
  // parce qu'il en détient des carcasses, ne peut pas s'y inscrire — il garderait l'accès une fois
  // les carcasses parties et évincerait le premier détenteur désigné. Comme pour les colonnes
  // réservées au SVI dans `sync-carcasse`, on ignore la valeur au lieu de rejeter la fiche.
  const canWriteOwnership = !existingFei || scope.isFeiOwner(existingFei);

  // L'approbation de mise sur le marché est la signature réglementaire de l'examinateur initial.
  // Elle est portée par la fiche, donc `canWriteFei` seul l'ouvrirait à tout détenteur aval qui
  // détient une carcasse — un ETG pourrait la poser ou l'effacer sans que rien ne le signale, cette
  // écriture-là réussissant silencieusement. `isFeiOwner` seul serait à l'inverse trop strict :
  // quand une asso est désignée premier détenteur, c'est un de ses membres qui valide, et il n'est
  // rattaché à la fiche que par son entité (voir `isPremierDetenteur`, chasseur-fei.tsx).
  const canWriteApprobationExaminateur =
    !existingFei ||
    scope.isFeiOwner(existingFei) ||
    (!!existingFei.premier_detenteur_entity_id &&
      scope.entityIds.includes(existingFei.premier_detenteur_entity_id));

  const nextFei: Prisma.FeiUncheckedUpdateInput = {
    is_synced: true,
  };

  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
    nextFei.date_mise_a_mort = body.date_mise_a_mort || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.consommateur_final_usage_domestique)) {
    nextFei.consommateur_final_usage_domestique = body.consommateur_final_usage_domestique
      ? sanitize(body.consommateur_final_usage_domestique as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.creation_context)) {
    const contextSlug = body.creation_context;
    if (contextSlug) {
      if (contextSlug !== 'zacharie') {
        const apiKey = await prisma.apiKey.findFirst({
          where: { slug_for_context: contextSlug },
        });
        if (!apiKey) {
          throw new Error('Invalid context slug');
        }
      }
      nextFei.creation_context = sanitize(contextSlug as string);
    }
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.commune_mise_a_mort)) {
    nextFei.commune_mise_a_mort = body.commune_mise_a_mort
      ? sanitize(body.commune_mise_a_mort as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse)) {
    nextFei.heure_mise_a_mort_premiere_carcasse = body.heure_mise_a_mort_premiere_carcasse
      ? sanitize(body.heure_mise_a_mort_premiere_carcasse as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse)) {
    nextFei.heure_evisceration_derniere_carcasse = body.heure_evisceration_derniere_carcasse
      ? sanitize(body.heure_evisceration_derniere_carcasse as string)
      : null;
  }
  if (canWriteOwnership && body.hasOwnProperty(Prisma.FeiScalarFieldEnum.created_by_user_id)) {
    nextFei.created_by_user_id = body.created_by_user_id ? sanitize(body.created_by_user_id as string) : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.resume_nombre_de_carcasses)) {
    nextFei.resume_nombre_de_carcasses = body.resume_nombre_de_carcasses || null;
  }

  /*
  *
  *
  * *

  Examinateur initial

  */

  if (canWriteOwnership && body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    nextFei.examinateur_initial_user_id = body.examinateur_initial_user_id
      ? sanitize(body.examinateur_initial_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_offline)) {
    nextFei.examinateur_initial_offline = body.examinateur_initial_offline || null;
  }
  if (
    canWriteApprobationExaminateur &&
    body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche)
  ) {
    nextFei.examinateur_initial_approbation_mise_sur_le_marche =
      body.examinateur_initial_approbation_mise_sur_le_marche || null;
  }
  if (
    canWriteApprobationExaminateur &&
    body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche)
  ) {
    nextFei.examinateur_initial_date_approbation_mise_sur_le_marche =
      body.examinateur_initial_date_approbation_mise_sur_le_marche || null;
  }

  /*
  *
  *
  * *

  Premier détenteur

  */

  if (canWriteOwnership && body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
    nextFei.premier_detenteur_user_id = body.premier_detenteur_user_id
      ? sanitize(body.premier_detenteur_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_offline)) {
    nextFei.premier_detenteur_offline = body.premier_detenteur_offline || null;
  }
  if (canWriteOwnership && body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_entity_id)) {
    nextFei.premier_detenteur_entity_id = body.premier_detenteur_entity_id
      ? sanitize(body.premier_detenteur_entity_id as string)
      : null;
  }
  if (canWriteOwnership && body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache)) {
    nextFei.premier_detenteur_name_cache = body.premier_detenteur_name_cache
      ? sanitize(body.premier_detenteur_name_cache as string)
      : null;
  }

  const savedFei = existingFei
    ? await prisma.fei.update({
        where: { numero },
        data: nextFei,
      })
    : await prisma.fei.create({
        data: {
          ...(nextFei as Prisma.FeiUncheckedCreateInput),
          numero,
          created_by_user_id: user.id,
        },
      });

  if (!existingFei) {
    existingFei = savedFei;
  }

  return { savedFei, existingFei, isDeleted: false };
}
