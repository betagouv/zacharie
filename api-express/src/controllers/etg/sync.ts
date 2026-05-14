import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { SyncRequest, SyncResponse } from '~/types/responses';
import prisma from '~/prisma';
import { Carcasse, CarcasseIntermediaire, EntityRelationType, Prisma, User } from '@prisma/client';
import { runFeiUpdateSideEffects } from '~/utils/fei-side-effects';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';
import { capture } from '~/third-parties/sentry';
import { FeiPopulated, feiPopulatedInclude } from '~/types/fei';
import { feiBodyZodSchema } from '~/utils/sync-fei';
import { sanitize } from '~/utils/sanitize';
import { CarcasseBodyZodSchema } from '~/utils/sync-carcasse';
import { carcasseIntermediaireBodyZodSchema } from '~/utils/sync-carcasse-intermediaire';

const router: express.Router = express.Router();

/**
 * POST /sync
 * Bulk sync endpoint that processes all unsynced data in a single request.
 * Order: FEIs -> Carcasses -> CarcassesIntermediaires -> Logs
 */
router.post(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response<SyncResponse>) => {
    const user = req.user as User;

    if (!user.activated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }

    const { feis, carcasses, carcassesIntermediaires, logs } = req.body as SyncRequest;

    const feiResults: Array<SaveFeiResult> = [];
    const carcasseResults: Array<SaveCarcasseResult> = [];
    const savedIntermediaires: Array<Prisma.CarcasseIntermediaireGetPayload<object>> = [];
    const syncedLogIds: Array<string> = [];

    // 1. Process FEIs first (carcasses depend on them)
    for (const feiData of feis || []) {
      try {
        const result = await syncFeiForEtg(feiData.numero, feiData as Prisma.FeiUncheckedCreateInput, user);
        feiResults.push(result);
      } catch (error) {
        capture(error as Error, {
          extra: { feiNumero: feiData.numero, userId: user.id },
          user,
        });
      }
    }

    // 2. Process Carcasses (intermediaires depend on them)
    for (const carcasseData of carcasses || []) {
      try {
        const result = await syncCarcasseForEtg(
          carcasseData.fei_numero,
          carcasseData.zacharie_carcasse_id,
          carcasseData as Prisma.CarcasseUncheckedCreateInput,
          user
        );
        carcasseResults.push(result);
      } catch (error) {
        capture(error as Error, {
          extra: {
            feiNumero: carcasseData.fei_numero,
            zacharieCarcasseId: carcasseData.zacharie_carcasse_id,
            userId: user.id,
          },
          user,
        });
      }
    }

    // 3. Process CarcassesIntermediaires
    for (const ciData of carcassesIntermediaires || []) {
      try {
        const saved = await saveCarcasseIntermediaireForEtg(
          ciData.fei_numero,
          ciData.intermediaire_id,
          ciData.zacharie_carcasse_id,
          ciData as Prisma.CarcasseIntermediaireUncheckedCreateInput
        );
        savedIntermediaires.push(saved);
      } catch (error) {
        capture(error as Error, {
          extra: {
            feiNumero: ciData.fei_numero,
            intermediaireId: ciData.intermediaire_id,
            zacharieCarcasseId: ciData.zacharie_carcasse_id,
            userId: user.id,
          },
          user,
        });
      }
    }

    // 4. Process Logs
    for (const logData of logs || []) {
      try {
        await prisma.log.upsert({
          where: { id: logData.id },
          create: {
            id: logData.id,
            user_id: logData.user_id!,
            user_role: logData.user_role!,
            fei_numero: logData.fei_numero ?? null,
            entity_id: logData.entity_id ?? null,
            zacharie_carcasse_id: logData.zacharie_carcasse_id ?? null,
            fei_intermediaire_id: logData.fei_intermediaire_id ?? null,
            carcasse_intermediaire_id: logData.carcasse_intermediaire_id ?? null,
            action: logData.action!,
            history: logData.history ?? null,
            date: logData.date ?? new Date(),
            is_synced: true,
          },
          update: {
            user_id: logData.user_id,
            user_role: logData.user_role,
            fei_numero: logData.fei_numero,
            entity_id: logData.entity_id,
            zacharie_carcasse_id: logData.zacharie_carcasse_id,
            fei_intermediaire_id: logData.fei_intermediaire_id,
            carcasse_intermediaire_id: logData.carcasse_intermediaire_id,
            action: logData.action,
            history: logData.history,
            date: logData.date,
            is_synced: true,
          },
        });
        syncedLogIds.push(logData.id);
      } catch (error) {
        capture(error as Error, {
          extra: { logId: logData.id, userId: user.id },
          user,
        });
      }
    }

    // Run side effects AFTER all saves (non-critical)
    for (const feiResult of feiResults) {
      try {
        if (!feiResult.isDeleted && feiResult.existingFei) {
          await runFeiUpdateSideEffects(feiResult.existingFei, feiResult.savedFei, user);
        }
      } catch (error) {
        capture(error as Error, {
          extra: { feiNumero: feiResult.savedFei.numero, context: 'fei_side_effects' },
          user,
        });
      }
    }

    for (const carcasseResult of carcasseResults) {
      try {
        if (!carcasseResult.isDeleted) {
          await runCarcasseUpdateSideEffects(carcasseResult.existingCarcasse, carcasseResult.savedCarcasse);
        }
      } catch (error) {
        capture(error as Error, {
          extra: {
            zacharieCarcasseId: carcasseResult.savedCarcasse.zacharie_carcasse_id,
            context: 'carcasse_side_effects',
          },
          user,
        });
      }
    }

    // Fetch populated FEIs for response
    const feiNumeros = feiResults.map((f) => f.savedFei.numero);
    const populatedFeis =
      feiNumeros.length > 0
        ? await prisma.fei.findMany({
            where: { numero: { in: feiNumeros } },
            include: feiPopulatedInclude,
          })
        : [];

    res.status(200).send({
      ok: true,
      data: {
        feis: populatedFeis,
        carcasses: carcasseResults.map((r) => r.savedCarcasse),
        carcassesIntermediaires: savedIntermediaires,
        syncedLogIds,
      },
      error: '',
    });
  })
);
interface SaveFeiResult {
  savedFei: FeiPopulated;
  existingFei: FeiPopulated | null;
  isDeleted: boolean;
}

async function syncFeiForEtg(
  numero: string,
  feiData: Prisma.FeiUncheckedCreateInput,
  user: User
): Promise<SaveFeiResult> {
  let result = feiBodyZodSchema.safeParse(feiData);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  const body = result.data;
  let existingFei = await prisma.fei.findUnique({
    where: { numero },
    include: feiPopulatedInclude,
  });

  if (!existingFei) {
    throw new Error('Seul un examinateur initial peut créer une fiche');
  }

  if (existingFei?.deleted_at) {
    return { savedFei: existingFei, existingFei, isDeleted: true };
  }

  if (body.deleted_at && !existingFei.deleted_at) {
    throw new Error('Unauthorized');
  }

  const nextFei: Prisma.FeiUncheckedUpdateInput = {
    is_synced: true,
  };

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

export interface SaveCarcasseResult {
  savedCarcasse: Carcasse;
  existingCarcasse: Carcasse;
  isDeleted: boolean;
}

export async function syncCarcasseForEtg(
  fei_numero: string,
  zacharie_carcasse_id: string,
  carcasseData: Prisma.CarcasseUncheckedCreateInput,
  user: User
): Promise<SaveCarcasseResult> {
  let result = CarcasseBodyZodSchema.safeParse(carcasseData);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  const body = result.data;
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
    throw new Error('Carcasse non trouvée');
  }

  if (body.deleted_at && !existingCarcasse.deleted_at) {
    throw new Error('Unauthorized');
  }

  const nextCarcasse: Prisma.CarcasseUncheckedUpdateInput = {
    is_synced: true,
  };

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

  const updatedCarcasse = await prisma.carcasse.update({
    where: {
      zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
    },
    data: nextCarcasse,
  });

  return { savedCarcasse: updatedCarcasse, existingCarcasse, isDeleted: false };
}

async function saveCarcasseIntermediaireForEtg(
  fei_numero: string,
  intermediaire_id: string,
  zacharie_carcasse_id: string,
  ciData: Prisma.CarcasseIntermediaireUncheckedCreateInput
): Promise<CarcasseIntermediaire> {
  let result = carcasseIntermediaireBodyZodSchema.safeParse(ciData);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  const body = result.data;
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
  const existingCarcasse = await prisma.carcasse.findFirst({
    where: {
      zacharie_carcasse_id,
      fei_numero,
    },
  });
  if (!existingCarcasse) {
    throw new Error('Carcasse not found');
  }
  if (!intermediaire_id) {
    throw new Error("L'identifiant du destinataire est obligatoire");
  }

  const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
    fei_numero: fei_numero,
    numero_bracelet: existingCarcasse.numero_bracelet,
    zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
    intermediaire_id,
    intermediaire_entity_id: body.intermediaire_entity_id,
    intermediaire_role: body.intermediaire_role,
    intermediaire_user_id: body.intermediaire_user_id,
    is_synced: true,
  };

  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire)) {
    data.commentaire = body[Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids)) {
    data.intermediaire_poids = body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge)) {
    data.prise_en_charge = body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.ecarte_pour_inspection)) {
    data.ecarte_pour_inspection = body[Prisma.CarcasseIntermediaireScalarFieldEnum.ecarte_pour_inspection];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel)) {
    data.check_manuel = body[Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.manquante)) {
    data.manquante = body[Prisma.CarcasseIntermediaireScalarFieldEnum.manquante];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.refus)) {
    data.refus = body[Prisma.CarcasseIntermediaireScalarFieldEnum.refus];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.decision_at)) {
    data.decision_at = body[Prisma.CarcasseIntermediaireScalarFieldEnum.decision_at];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at)) {
    data.prise_en_charge_at = body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at];
  }
  if (
    body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_id_cache)
  ) {
    data.intermediaire_prochain_detenteur_id_cache =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_id_cache];
  }
  if (
    body.hasOwnProperty(
      Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_role_cache
    )
  ) {
    data.intermediaire_prochain_detenteur_role_cache =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_role_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_type)) {
    data.intermediaire_depot_type =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_type];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_entity_id)) {
    data.intermediaire_depot_entity_id =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.nombre_d_animaux_acceptes)) {
    data.nombre_d_animaux_acceptes =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.nombre_d_animaux_acceptes] ?? null;
  }

  const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
    where: {
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: fei_numero,
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        intermediaire_id: intermediaire_id,
      },
    },
    create: data,
    update: data,
  });

  return carcasseIntermediaire;
}

export default router;
