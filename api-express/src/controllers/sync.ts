import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { SyncRequest, SyncResponse } from '~/types/responses';
import prisma from '~/prisma';
import { Prisma, User } from '@prisma/client';
import { saveFei, runFeiSideEffects, SaveFeiResult } from './fei';
import { saveCarcasse, runCarcasseSideEffects, SaveCarcasseResult } from './fei-carcasse';
import { saveCarcasseIntermediaire } from './fei-carcasse-intermediaire';
import { capture } from '~/third-parties/sentry';
import { feiPopulatedInclude } from '~/types/fei';

const router: express.Router = express.Router();

/**
 * POST /sync
 * Bulk sync endpoint that processes all unsynced data in a single transaction
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

    // Track results for side effects
    const feiResults: Array<SaveFeiResult & { body: Prisma.FeiUncheckedCreateInput }> = [];
    const carcasseResults: Array<SaveCarcasseResult> = [];

    try {
      // Process all data in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const savedFeis: Array<SaveFeiResult & { body: Prisma.FeiUncheckedCreateInput }> = [];
        const savedCarcasses: Array<SaveCarcasseResult> = [];
        const savedIntermediaires: Array<Prisma.CarcasseIntermediaireGetPayload<{}>> = [];
        const syncedLogIds: Array<string> = [];

        // 1. Process FEIs first (carcasses depend on them)
        for (const feiData of feis || []) {
          try {
            const result = await saveFei(feiData.numero, feiData as Prisma.FeiUncheckedCreateInput, user, tx);
            savedFeis.push({ ...result, body: feiData as Prisma.FeiUncheckedCreateInput });
          } catch (error) {
            // Log but continue - don't fail the entire sync for one FEI
            capture(error, {
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
              tx,
            );
            savedCarcasses.push(result);
          } catch (error) {
            // Log but continue
            capture(error, {
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
              tx,
            );
            savedIntermediaires.push(saved);
          } catch (error) {
            // Log but continue
            capture(error, {
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
            await tx.log.upsert({
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
            // Log but continue
            capture(error, {
              extra: { logId: logData.id, userId: user.id },
              user,
            });
          }
        }

        // Fetch updated FEIs with full relations for response
        const feiNumeros = savedFeis.map((f) => f.savedFei.numero);
        const populatedFeis =
          feiNumeros.length > 0
            ? await tx.fei.findMany({
                where: { numero: { in: feiNumeros } },
                include: feiPopulatedInclude,
              })
            : [];

        return {
          savedFeis,
          savedCarcasses,
          savedIntermediaires,
          syncedLogIds,
          populatedFeis,
        };
      });

      // Store results for side effects
      feiResults.push(...result.savedFeis);
      carcasseResults.push(...result.savedCarcasses);

      // Run side effects AFTER transaction commits (notifications, webhooks, etc.)
      // These are non-critical and shouldn't rollback the sync
      for (const feiResult of feiResults) {
        try {
          if (!feiResult.isDeleted) {
            await runFeiSideEffects(feiResult.savedFei, feiResult.existingFei, feiResult.body, user);
          }
        } catch (error) {
          capture(error, {
            extra: { feiNumero: feiResult.savedFei.numero, context: 'fei_side_effects' },
            user,
          });
        }
      }

      for (const carcasseResult of carcasseResults) {
        try {
          if (!carcasseResult.isDeleted) {
            await runCarcasseSideEffects(carcasseResult.savedCarcasse, carcasseResult.existingCarcasse);
          }
        } catch (error) {
          capture(error, {
            extra: {
              zacharieCarcasseId: carcasseResult.savedCarcasse.zacharie_carcasse_id,
              context: 'carcasse_side_effects',
            },
            user,
          });
        }
      }

      res.status(200).send({
        ok: true,
        data: {
          feis: result.populatedFeis,
          carcasses: result.savedCarcasses.map((r) => r.savedCarcasse),
          carcassesIntermediaires: result.savedIntermediaires,
          syncedLogIds: result.syncedLogIds,
        },
        error: '',
      });
    } catch (error) {
      capture(error, {
        extra: { context: 'sync_transaction', userId: user.id },
        user,
      });
      throw error;
    }
  }),
);

export default router;
