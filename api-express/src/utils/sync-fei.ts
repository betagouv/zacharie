import prisma from '~/prisma';
import { sanitize } from '~/utils/sanitize';
import { EntityRelationType, FeiOwnerRole, Prisma, User, UserRoles } from '@prisma/client';
import { FeiPopulated, feiPopulatedInclude } from '~/types/fei';
import { capture } from '~/third-parties/sentry';
import { z } from 'zod';

export const feiBodyZodSchema = z.object({
  date_mise_a_mort: z.string().optional().nullable(),
  commune_mise_a_mort: z.string().optional().nullable(),
  heure_mise_a_mort_premiere_carcasse: z.string().optional().nullable(),
  heure_evisceration_derniere_carcasse: z.string().optional().nullable(),
  created_by_user_id: z.string().optional().nullable(),
  creation_context: z.string().optional().nullable(),
  resume_nombre_de_carcasses: z.string().optional().nullable(),
  automatic_closed_at: z.string().optional().nullable(),
  examinateur_initial_offline: z.boolean().optional().nullable(),
  examinateur_initial_user_id: z.string().optional().nullable(),
  examinateur_initial_approbation_mise_sur_le_marche: z.boolean().optional().nullable(),
  examinateur_initial_date_approbation_mise_sur_le_marche: z.string().optional().nullable(),
  consommateur_final_usage_domestique: z.string().optional().nullable(),
  premier_detenteur_offline: z.boolean().optional().nullable(),
  premier_detenteur_user_id: z.string().optional().nullable(),
  premier_detenteur_entity_id: z.string().optional().nullable(),
  premier_detenteur_name_cache: z.string().optional().nullable(),
  premier_detenteur_depot_type: z.string().optional().nullable(),
  premier_detenteur_depot_entity_id: z.string().optional().nullable(),
  premier_detenteur_depot_entity_name_cache: z.string().optional().nullable(),
  premier_detenteur_depot_ccg_at: z.string().optional().nullable(),
  premier_detenteur_transport_type: z.string().optional().nullable(),
  premier_detenteur_transport_date: z.string().optional().nullable(),
  premier_detenteur_prochain_detenteur_role_cache: z.string().optional().nullable(),
  premier_detenteur_prochain_detenteur_id_cache: z.string().optional().nullable(),
  intermediaire_closed_at: z.string().optional().nullable(),
  intermediaire_closed_by_user_id: z.string().optional().nullable(),
  intermediaire_closed_by_entity_id: z.string().optional().nullable(),
  latest_intermediaire_user_id: z.string().optional().nullable(),
  latest_intermediaire_entity_id: z.string().optional().nullable(),
  latest_intermediaire_name_cache: z.string().optional().nullable(),
  svi_assigned_at: z.string().optional().nullable(),
  svi_entity_id: z.string().optional().nullable(),
  svi_user_id: z.string().optional().nullable(),
  svi_closed_at: z.string().optional().nullable(),
  svi_closed_by_user_id: z.string().optional().nullable(),
  fei_current_owner_user_id: z.string().optional().nullable(),
  fei_current_owner_user_name_cache: z.string().optional().nullable(),
  fei_current_owner_entity_id: z.string().optional().nullable(),
  fei_current_owner_entity_name_cache: z.string().optional().nullable(),
  fei_current_owner_role: z
    .enum(Object.values(FeiOwnerRole) as [FeiOwnerRole, ...FeiOwnerRole[]])
    .optional()
    .nullable(),
  fei_next_owner_wants_to_sous_traite: z.boolean().optional().nullable(),
  fei_next_owner_sous_traite_at: z.string().optional().nullable(),
  fei_next_owner_sous_traite_by_user_id: z.string().optional().nullable(),
  fei_next_owner_sous_traite_by_entity_id: z.string().optional().nullable(),
  fei_next_owner_user_id: z.string().optional().nullable(),
  fei_next_owner_user_name_cache: z.string().optional().nullable(),
  fei_next_owner_entity_id: z.string().optional().nullable(),
  fei_next_owner_entity_name_cache: z.string().optional().nullable(),
  fei_next_owner_role: z
    .enum(Object.values(FeiOwnerRole) as [FeiOwnerRole, ...FeiOwnerRole[]])
    .optional()
    .nullable(),
  fei_prev_owner_user_id: z.string().optional().nullable(),
  fei_prev_owner_entity_id: z.string().optional().nullable(),
  fei_prev_owner_role: z
    .enum(Object.values(FeiOwnerRole) as [FeiOwnerRole, ...FeiOwnerRole[]])
    .optional()
    .nullable(),
  deleted_at: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  is_synced: z.boolean().optional().nullable(),
});

export interface SaveFeiResult {
  savedFei: FeiPopulated;
  existingFei: FeiPopulated | null;
  isDeleted: boolean;
}

export async function syncFei(
  numero: string,
  body: Prisma.FeiUncheckedCreateInput,
  user: User
): Promise<SaveFeiResult> {
  let result = feiBodyZodSchema.safeParse(body);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  let existingFei = await prisma.fei.findUnique({
    where: { numero },
    include: feiPopulatedInclude,
  });

  if (!existingFei) {
    const isExaminateurInitial =
      user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei && !!user.activated;
    if (!isExaminateurInitial) {
      capture(new Error('Tentative de hack: seul un examinateur initial peut créer une fiche'), {
        extra: {
          body: body,
          feiNumero: numero,
        },
        user,
      });
      throw new Error('Seul un examinateur initial peut créer une fiche');
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
      (user.roles.includes(UserRoles.CHASSEUR) && existingFei.examinateur_initial_user_id === user.id) ||
      (user.roles.includes(UserRoles.CHASSEUR) && existingFei.fei_current_owner_user_id === user.id);
    if (!canDelete) {
      throw new Error('Unauthorized');
    }
    const deletedFei = await prisma.fei.update({
      where: { numero },
      data: { deleted_at: body.deleted_at },
      include: feiPopulatedInclude,
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
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.created_by_user_id)) {
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

  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
    nextFei.examinateur_initial_user_id = body.examinateur_initial_user_id
      ? sanitize(body.examinateur_initial_user_id as string)
      : null;
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

  /*
  *
  *
  * *

  Premier détenteur

  */

  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
    nextFei.premier_detenteur_user_id = body.premier_detenteur_user_id
      ? sanitize(body.premier_detenteur_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_offline)) {
    nextFei.premier_detenteur_offline = body.premier_detenteur_offline || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_entity_id)) {
    nextFei.premier_detenteur_entity_id = body.premier_detenteur_entity_id
      ? sanitize(body.premier_detenteur_entity_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache)) {
    nextFei.premier_detenteur_name_cache = body.premier_detenteur_name_cache
      ? sanitize(body.premier_detenteur_name_cache as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id)) {
    nextFei.premier_detenteur_depot_entity_id = body.premier_detenteur_depot_entity_id
      ? sanitize(body.premier_detenteur_depot_entity_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_name_cache)) {
    nextFei.premier_detenteur_depot_entity_name_cache = body.premier_detenteur_depot_entity_name_cache
      ? sanitize(body.premier_detenteur_depot_entity_name_cache as string)
      : null;
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
    nextFei.premier_detenteur_prochain_detenteur_id_cache = body.premier_detenteur_prochain_detenteur_id_cache
      ? sanitize(body.premier_detenteur_prochain_detenteur_id_cache as string)
      : null;
  }

  /*
*
*
* *

Responsabilités

*/
  /*  Current Owner */

  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id)) {
    nextFei.fei_current_owner_user_id = body.fei_current_owner_user_id
      ? sanitize(body.fei_current_owner_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_user_name_cache)) {
    nextFei.fei_current_owner_user_name_cache = body.fei_current_owner_user_name_cache
      ? sanitize(body.fei_current_owner_user_name_cache as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
    nextFei.fei_current_owner_entity_id = body.fei_current_owner_entity_id
      ? sanitize(body.fei_current_owner_entity_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_name_cache)) {
    nextFei.fei_current_owner_entity_name_cache = body.fei_current_owner_entity_name_cache
      ? sanitize(body.fei_current_owner_entity_name_cache as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_role)) {
    nextFei.fei_current_owner_role = body.fei_current_owner_role || null;
  }
  /* Sous-traitance */
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_wants_to_sous_traite)) {
    nextFei.fei_next_owner_wants_to_sous_traite = body.fei_next_owner_wants_to_sous_traite || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_sous_traite_at)) {
    nextFei.fei_next_owner_sous_traite_at = body.fei_next_owner_sous_traite_at || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_sous_traite_by_user_id)) {
    nextFei.fei_next_owner_sous_traite_by_user_id = body.fei_next_owner_sous_traite_by_user_id
      ? sanitize(body.fei_next_owner_sous_traite_by_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_sous_traite_by_entity_id)) {
    nextFei.fei_next_owner_sous_traite_by_entity_id = body.fei_next_owner_sous_traite_by_entity_id
      ? sanitize(body.fei_next_owner_sous_traite_by_entity_id as string)
      : null;
  }
  /*  Next Owner */
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
    nextFei.fei_next_owner_user_id = body.fei_next_owner_user_id
      ? sanitize(body.fei_next_owner_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_user_name_cache)) {
    nextFei.fei_next_owner_user_name_cache = body.fei_next_owner_user_name_cache
      ? sanitize(body.fei_next_owner_user_name_cache as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
    nextFei.fei_next_owner_entity_id = body.fei_next_owner_entity_id
      ? sanitize(body.fei_next_owner_entity_id as string)
      : null;
    if (body.fei_next_owner_entity_id) {
      const nextRelation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
        entity_id: body.fei_next_owner_entity_id,
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
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_name_cache)) {
    nextFei.fei_next_owner_entity_name_cache = body.fei_next_owner_entity_name_cache
      ? sanitize(body.fei_next_owner_entity_name_cache as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_role)) {
    nextFei.fei_next_owner_role = body.fei_next_owner_role || null;
  }
  /*  Prev Owner */
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id)) {
    nextFei.fei_prev_owner_user_id = body.fei_prev_owner_user_id
      ? sanitize(body.fei_prev_owner_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id)) {
    nextFei.fei_prev_owner_entity_id = body.fei_prev_owner_entity_id
      ? sanitize(body.fei_prev_owner_entity_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_role)) {
    nextFei.fei_prev_owner_role = body.fei_prev_owner_role || null;
  }

  /*
*
*
* *

Intermédiaire

*/
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_at)) {
    nextFei.intermediaire_closed_at = body.intermediaire_closed_at || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_by_user_id)) {
    nextFei.intermediaire_closed_by_user_id = body.intermediaire_closed_by_user_id
      ? sanitize(body.intermediaire_closed_by_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_by_entity_id)) {
    nextFei.intermediaire_closed_by_entity_id = body.intermediaire_closed_by_entity_id
      ? sanitize(body.intermediaire_closed_by_entity_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.latest_intermediaire_user_id)) {
    nextFei.latest_intermediaire_user_id = body.latest_intermediaire_user_id
      ? sanitize(body.latest_intermediaire_user_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.latest_intermediaire_entity_id)) {
    nextFei.latest_intermediaire_entity_id = body.latest_intermediaire_entity_id
      ? sanitize(body.latest_intermediaire_entity_id as string)
      : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.latest_intermediaire_name_cache)) {
    nextFei.latest_intermediaire_name_cache = body.latest_intermediaire_name_cache
      ? sanitize(body.latest_intermediaire_name_cache as string)
      : null;
  }

  /*
*
*
* *

SVI

*/
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_closed_at)) {
    nextFei.svi_closed_at = body.svi_closed_at || null;
    if (body.svi_closed_at) nextFei.svi_closed_by_user_id = user.id;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_assigned_at)) {
    nextFei.svi_assigned_at = body.svi_assigned_at || null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_entity_id)) {
    nextFei.svi_entity_id = body.svi_entity_id ? sanitize(body.svi_entity_id as string) : null;
  }
  if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_user_id)) {
    nextFei.svi_user_id = body.svi_user_id ? sanitize(body.svi_user_id as string) : null;
  }

  const savedFei = existingFei
    ? await prisma.fei.update({
        where: { numero },
        data: nextFei,
        include: feiPopulatedInclude,
      })
    : await prisma.fei.create({
        data: {
          ...(nextFei as Prisma.FeiUncheckedCreateInput),
          numero,
          created_by_user_id: user.id,
        },
        include: feiPopulatedInclude,
      });

  if (!existingFei) {
    existingFei = savedFei;
  }

  return { savedFei, existingFei, isDeleted: false };
}
