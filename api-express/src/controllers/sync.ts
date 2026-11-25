import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { SyncRejection, SyncRequest, SyncResponse } from '~/types/responses';
import prisma from '~/prisma';
import { Prisma, User, UserRoles, Carcasse, Fei } from '@prisma/client';
import { syncFei, type SaveFeiResult } from '~/utils/sync-fei';
import { syncCarcasse, type SaveCarcasseResult } from '~/utils/sync-carcasse';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';
import { createSyncScope } from '~/utils/sync-scope';
import {
  syncCarcasseModifRequest,
  runCarcasseModifRequestSideEffects,
  type SyncModifRequestResult,
} from '~/utils/sync-carcasse-modification-request';
import { runFeiUpdateSideEffects } from '~/utils/fei-side-effects';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';
import { SyncRejectedError, SyncRejectedErrorMessage } from '~/utils/sync-errors';
import { findDeletedEntityIds } from '~/utils/deleted-entities';
import { capture } from '~/third-parties/sentry';
import { redactPersonalData } from '~/utils/redact-personal-data';

const router: express.Router = express.Router();

router.post(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response<SyncResponse>) => {
    const user = req.user as User;

    const isExaminateurInitialNotYetActivated = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
    if (!user.activated && !isExaminateurInitialNotYetActivated) {
      res.status(400).send({
        ok: false,
        data: null,
        error: "Le compte n'est pas activé",
      });
      return;
    }

    const { feis, carcasses, carcassesIntermediaires, carcasseModifRequests, logs } = req.body as SyncRequest;

    const feiResults: Array<SaveFeiResult> = [];
    const carcasseResults: Array<SaveCarcasseResult> = [];
    const savedIntermediaires: Array<Prisma.CarcasseIntermediaireGetPayload<object>> = [];
    const modifResults: Array<SyncModifRequestResult & { approvalPayload?: Record<string, unknown> }> = [];
    const syncedLogIds: Array<string> = [];
    const rejected: Array<SyncRejection> = [];
    const shouldRemoveFromLocalStore: Array<SyncRejection> = [];
    const rejectedBodies: Array<Omit<SyncRejection, 'reason'> & { body: unknown }> = [];
    const MAX_REJECTED_BODIES = 20;

    const removeFromLocalStoreReasons: Array<SyncRejectedErrorMessage> = [
      "Vous n'avez pas accès à cette carcasse",
      "Vous n'avez pas accès à cette fiche",
    ];
    function handleSyncError(error: unknown, item: Omit<SyncRejection, 'reason'>, body: unknown) {
      if (error instanceof SyncRejectedError) {
        rejected.push({ ...item, reason: error.message });
        if (rejectedBodies.length < MAX_REJECTED_BODIES) {
          rejectedBodies.push({ ...item, body: redactPersonalData(body) });
        }
        if (removeFromLocalStoreReasons.includes(error.message as SyncRejectedErrorMessage)) {
          shouldRemoveFromLocalStore.push({ ...item, reason: error.message });
        }
        return;
      }
      capture(error as Error, { extra: { ...item, userId: user.id }, user });
    }

    const scope = await createSyncScope(user);

    const deletedEntityIds = await findDeletedEntityIds(
      [
        ...(feis || []).map((f) => f.premier_detenteur_entity_id),
        ...(carcasses || []).flatMap((c) => [
          c.next_owner_entity_id,
          c.premier_detenteur_depot_entity_id,
          c.premier_detenteur_entity_id,
        ]),
      ].filter((id): id is string => !!id)
    );

    for (const feiData of feis || []) {
      try {
        const result = await syncFei(feiData.numero, feiData as Prisma.FeiUncheckedCreateInput, user, scope, {
          deletedEntityIds,
        });
        feiResults.push(result);
      } catch (error) {
        handleSyncError(error, { kind: 'fei', id: feiData.numero }, feiData);
      }
    }

    const carcasseList = carcasses || [];
    const carcasseFeiNumeros = [
      ...new Set(carcasseList.map((c) => c.fei_numero).filter(Boolean)),
    ] as string[];
    const carcasseFeiMap = new Map<string, Fei>();
    if (carcasseFeiNumeros.length > 0) {
      const feisForCarcasses = await prisma.fei.findMany({
        where: { numero: { in: carcasseFeiNumeros } },
      });
      for (const f of feisForCarcasses) carcasseFeiMap.set(f.numero, f);
    }
    const carcasseIds = [
      ...new Set(carcasseList.map((c) => c.zacharie_carcasse_id).filter(Boolean)),
    ] as string[];
    const existingCarcasseMap = new Map<string, Carcasse>();
    if (carcasseIds.length > 0) {
      const existingCarcasses =
        (await prisma.carcasse.findMany({
          where: { zacharie_carcasse_id: { in: carcasseIds } },
        })) ?? [];
      for (const c of existingCarcasses) existingCarcasseMap.set(c.zacharie_carcasse_id, c);
    }
    await scope.prefetch(carcasseIds);

    const ensuredRelations = new Map<string, Promise<void>>();

    const CARCASSE_SYNC_CONCURRENCY = 10;
    for (let i = 0; i < carcasseList.length; i += CARCASSE_SYNC_CONCURRENCY) {
      const chunk = carcasseList.slice(i, i + CARCASSE_SYNC_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (carcasseData) => {
          try {
            return await syncCarcasse(
              carcasseData.fei_numero,
              carcasseData.zacharie_carcasse_id,
              carcasseData as Prisma.CarcasseUncheckedCreateInput,
              user,
              scope,
              {
                existingFei: carcasseFeiMap.get(carcasseData.fei_numero) ?? null,
                existingCarcasse: existingCarcasseMap.get(carcasseData.zacharie_carcasse_id) ?? null,
                ensuredRelations,
                deletedEntityIds,
              }
            );
          } catch (error) {
            handleSyncError(error, { kind: 'carcasse', id: carcasseData.zacharie_carcasse_id }, carcasseData);
            return null;
          }
        })
      );
      for (const result of chunkResults) {
        if (result) carcasseResults.push(result);
      }
    }

    await scope.prefetch(
      (carcassesIntermediaires || []).map((ci) => ci.zacharie_carcasse_id).filter(Boolean) as string[]
    );
    for (const ciData of carcassesIntermediaires || []) {
      try {
        const saved = await syncCarcasseIntermediaire(
          ciData.fei_numero,
          ciData.intermediaire_id,
          ciData.zacharie_carcasse_id,
          ciData as Prisma.CarcasseIntermediaireUncheckedCreateInput,
          user,
          scope
        );
        savedIntermediaires.push(saved);
      } catch (error) {
        handleSyncError(
          error,
          {
            kind: 'carcasseIntermediaire',
            id: `${ciData.fei_numero}_${ciData.zacharie_carcasse_id}_${ciData.intermediaire_id}`,
          },
          ciData
        );
      }
    }

    await scope.prefetch(
      (carcasseModifRequests || []).map((m) => m.zacharie_carcasse_id).filter(Boolean) as string[]
    );
    for (const modifData of carcasseModifRequests || []) {
      try {
        const { _approvalPayload, ...modifBody } = modifData as typeof modifData & {
          _approvalPayload?: Record<string, unknown>;
        };
        const result = await syncCarcasseModifRequest(
          modifBody as Prisma.CarcasseModificationRequestUncheckedCreateInput,
          user,
          scope
        );
        modifResults.push({ ...result, approvalPayload: _approvalPayload });
      } catch (error) {
        handleSyncError(error, { kind: 'carcasseModifRequest', id: modifData.id as string }, modifData);
      }
    }

    const logsWithId = (logs || []).filter((l) => l.id);
    const logsToSync = logsWithId.filter((l) => l.user_id === user.id);
    const forgedLogs = logsWithId.filter((l) => l.user_id !== user.id);
    if (forgedLogs.length > 0) {
      capture(new Error('User ID does not match'), {
        extra: { logIds: forgedLogs.map((l) => l.id), userId: user.id },
        user,
      });
    }
    if (logsToSync.length > 0) {
      try {
        await prisma.log.createMany({
          data: logsToSync.map((logData) => ({
            id: logData.id,
            user_id: user.id,
            user_role: logData.user_role!,
            fei_numero: logData.fei_numero ?? null,
            entity_id: logData.entity_id ?? null,
            zacharie_carcasse_id: logData.zacharie_carcasse_id ?? null,
            fei_intermediaire_id: logData.fei_intermediaire_id ?? null,
            carcasse_intermediaire_id: logData.carcasse_intermediaire_id ?? null,
            action: logData.action!,
            history: logData.history ?? Prisma.DbNull,
            date: logData.date ?? new Date(),
            is_synced: true,
          })),
          skipDuplicates: true,
        });
        syncedLogIds.push(...logsToSync.map((l) => l.id));
      } catch (error) {
        capture(error as Error, {
          extra: { logIds: logsToSync.map((l) => l.id), userId: user.id },
          user,
        });
      }
    }

    for (const carcasseResult of carcasseResults) {
      try {
        if (!carcasseResult.isDeleted) {
          await runCarcasseUpdateSideEffects(
            carcasseResult.existingCarcasse,
            carcasseResult.savedCarcasse,
            user
          );
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

    for (const r of modifResults) {
      try {
        await runCarcasseModifRequestSideEffects(r, user, r.approvalPayload);
      } catch (error) {
        capture(error as Error, {
          extra: { modifId: r.saved.id, context: 'modif_request_side_effects' },
          user,
        });
      }
    }

    const touchedCarcasseIds = new Set<string>();
    for (const r of modifResults) {
      if (r.isNew || r.transitionedTo || r.justCancelled)
        touchedCarcasseIds.add(r.saved.zacharie_carcasse_id);
    }
    const refreshedCarcasses =
      touchedCarcasseIds.size > 0
        ? await prisma.carcasse.findMany({
            where: { zacharie_carcasse_id: { in: [...touchedCarcasseIds] } },
          })
        : [];
    const mergedCarcasses = new Map<string, Carcasse>();
    for (const cr of carcasseResults)
      mergedCarcasses.set(cr.savedCarcasse.zacharie_carcasse_id, cr.savedCarcasse);
    for (const rc of refreshedCarcasses) mergedCarcasses.set(rc.zacharie_carcasse_id, rc);

    const feiNumeros = feiResults.map((f) => f.savedFei.numero);
    const feisFetched =
      feiNumeros.length > 0
        ? await prisma.fei.findMany({
            where: { numero: { in: feiNumeros } },
          })
        : [];

    const writtenExistingCarcasseIds = carcasseResults
      .filter((cr) => !cr.isDeleted && existingCarcasseMap.has(cr.savedCarcasse.zacharie_carcasse_id))
      .map((cr) => cr.savedCarcasse.zacharie_carcasse_id);
    if (writtenExistingCarcasseIds.length > 0) {
      for (const id of await scope.outOfScope(writtenExistingCarcasseIds)) {
        shouldRemoveFromLocalStore.push({
          kind: 'carcasse',
          id,
          reason: "Vous n'avez pas accès à cette carcasse",
        });
      }
    }

    const removedCarcasseIds = shouldRemoveFromLocalStore
      .filter((item) => item.kind === 'carcasse')
      .map((item) => item.id);
    if (removedCarcasseIds.length > 0) {
      const alreadyListed = new Set(shouldRemoveFromLocalStore.map((item) => `${item.kind}:${item.id}`));
      const intermediaires =
        (await prisma.carcasseIntermediaire.findMany({
          where: { zacharie_carcasse_id: { in: removedCarcasseIds } },
          select: { fei_numero: true, zacharie_carcasse_id: true, intermediaire_id: true },
        })) ?? [];
      for (const ci of intermediaires) {
        const id = `${ci.fei_numero}_${ci.zacharie_carcasse_id}_${ci.intermediaire_id}`;
        if (alreadyListed.has(`carcasseIntermediaire:${id}`)) continue;
        shouldRemoveFromLocalStore.push({
          kind: 'carcasseIntermediaire',
          id,
          reason: "Vous n'avez pas accès à cette carcasse",
        });
      }
      const removedFeiNumeros = new Set(
        carcasseList
          .filter((c) => removedCarcasseIds.includes(c.zacharie_carcasse_id))
          .map((c) => c.fei_numero)
          .filter((numero) => !!numero && !alreadyListed.has(`fei:${numero}`))
      );
      const feisToCheck =
        removedFeiNumeros.size > 0
          ? ((await prisma.fei.findMany({ where: { numero: { in: [...removedFeiNumeros] } } })) ?? [])
          : [];
      for (const fei of feisToCheck) {
        if (await scope.canWriteFei(fei)) continue;
        shouldRemoveFromLocalStore.push({
          kind: 'fei',
          id: fei.numero,
          reason: "Vous n'avez pas accès à cette fiche",
        });
      }
    }

    if (rejected.length > 0) {
      capture(new Error('Écritures /sync refusées'), {
        extra: {
          count: rejected.length,
          rejected,
          rejectedBodies,
          bodiesTruncated: rejected.length > rejectedBodies.length,
          userId: user.id,
          appversion: req.headers.appversion,
          platform: req.headers.platform,
        },
        user,
      });
    }

    res.status(200).send({
      ok: true,
      data: {
        feis: feisFetched,
        carcasses: [...mergedCarcasses.values()],
        carcassesIntermediaires: savedIntermediaires,
        carcasseModifRequests: modifResults.map((r) => r.saved),
        syncedLogIds,
        rejected,
        shouldRemoveFromLocalStore,
      },
      error: '',
    });
  })
);

export default router;
