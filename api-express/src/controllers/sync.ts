import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { SyncRequest, SyncResponse } from '~/types/responses';
import prisma from '~/prisma';
import { Prisma, User } from '@prisma/client';
import { saveFei, type SaveFeiResult } from './fei';
import { saveCarcasse, type SaveCarcasseResult } from './fei-carcasse';
import { saveCarcasseIntermediaire } from './fei-carcasse-intermediaire';
import { runFeiUpdateSideEffects } from '~/utils/fei-side-effects';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';
import { capture } from '~/third-parties/sentry';
import { feiPopulatedInclude } from '~/types/fei';

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
        const result = await saveFei(feiData.numero, feiData as Prisma.FeiUncheckedCreateInput, user);
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
        const result = await saveCarcasse(
          carcasseData.fei_numero,
          carcasseData.zacharie_carcasse_id,
          carcasseData as Prisma.CarcasseUncheckedCreateInput,
          user,
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
        const saved = await saveCarcasseIntermediaire(
          ciData.fei_numero,
          ciData.intermediaire_id,
          ciData.zacharie_carcasse_id,
          ciData as Prisma.CarcasseIntermediaireUncheckedCreateInput,
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
  }),
);

export default router;
