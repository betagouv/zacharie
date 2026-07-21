import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { SyncRequest, SyncResponse } from '~/types/responses';
import prisma from '~/prisma';
import { Prisma, User, UserRoles, Carcasse, Fei, EntityRelationType } from '@prisma/client';
import { syncFei, type SaveFeiResult } from '~/utils/sync-fei';
import { syncCarcasse, type SaveCarcasseResult } from '~/utils/sync-carcasse';
import { syncCarcasseIntermediaire } from '~/utils/sync-carcasse-intermediaire';
import {
  syncCarcasseModifRequest,
  runCarcasseModifRequestSideEffects,
  type SyncModifRequestResult,
} from '~/utils/sync-carcasse-modification-request';
import { runFeiUpdateSideEffects } from '~/utils/fei-side-effects';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';
import { capture } from '~/third-parties/sentry';

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

    // Un chasseur formé (numéro CFEI) non encore activé peut synchroniser ses fiches en
    // préparation. La transmission reste bloquée plus bas (syncFei / syncCarcasse).
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

    // 1. Process FEIs first (carcasses depend on them)
    for (const feiData of feis || []) {
      try {
        const result = await syncFei(feiData.numero, feiData as Prisma.FeiUncheckedCreateInput, user);
        feiResults.push(result);
      } catch (error) {
        capture(error as Error, {
          extra: { feiNumero: feiData.numero, userId: user.id },
          user,
        });
      }
    }

    // 2. Process Carcasses (intermediaires depend on them)
    const carcasseList = carcasses || [];
    // Pré-charge en une requête les fiches ET les carcasses existantes référencées (au lieu d'un
    // findUnique + findFirst par carcasse), passées ensuite à chaque syncCarcasse.
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

    // Les carcasses sont traitées en parallèle (chaque syncCarcasse = un update de ligne
    // distincte, sans dépendance entre elles). La relation CAN_TRANSMIT vers le destinataire est
    // en revanche partagée : on l'assure séquentiellement AVANT la boucle parallèle (une fois par
    // entité) et on pré-remplit ensuredRelationEntityIds pour que syncCarcasse saute ce bloc et
    // évite toute création concurrente en double.
    const ensuredRelationEntityIds = new Set<string>();
    const nextOwnerEntityIds = [
      ...new Set(
        carcasseList
          .filter(
            (c) =>
              c.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.next_owner_entity_id) &&
              !!c.next_owner_entity_id
          )
          .map((c) => c.next_owner_entity_id as string)
      ),
    ];
    for (const entityId of nextOwnerEntityIds) {
      try {
        const relation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
          entity_id: entityId,
          owner_id: user.id,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          deleted_at: null,
        };
        const existingRelation = await prisma.entityAndUserRelations.findFirst({ where: relation });
        if (!existingRelation) {
          await prisma.entityAndUserRelations.create({ data: relation });
        }
      } catch (error) {
        capture(error as Error, { extra: { entityId, userId: user.id, context: 'ensure_relation' }, user });
      }
      ensuredRelationEntityIds.add(entityId);
    }

    // Concurrence bornée : on ne sature pas le pool de connexions Prisma (au-delà, les requêtes
    // sont simplement mises en file).
    const CARCASSE_SYNC_CONCURRENCY = 10;
    // Les transactions couplées (2b) tiennent une connexion pour toute leur durée : concurrence
    // plus basse pour ne pas épuiser le pool.
    const COUPLED_TRANSACTION_CONCURRENCY = 5;

    // Couplage prise-en-charge : un CarcasseIntermediaire arrive dans le même payload que le
    // changement d'ownership de sa carcasse. On les persiste dans UNE transaction par carcasse
    // pour qu'un intermédiaire invalide (ex : intermediaire_entity_id vide) rollback aussi
    // l'ownership — sinon la carcasse reste `current_owner = ETG` sans CarcasseIntermediaire
    // (fiche bloquée « à compléter » sans action possible côté ETG).
    const intermediairesList = carcassesIntermediaires || [];
    const carcasseListIds = new Set(carcasseList.map((c) => c.zacharie_carcasse_id));
    const coupledIntermediairesByCarcasseId = new Map<string, typeof intermediairesList>();
    for (const ciData of intermediairesList) {
      if (!carcasseListIds.has(ciData.zacharie_carcasse_id)) continue;
      const list = coupledIntermediairesByCarcasseId.get(ciData.zacharie_carcasse_id) ?? [];
      list.push(ciData);
      coupledIntermediairesByCarcasseId.set(ciData.zacharie_carcasse_id, list);
    }
    const uncoupledCarcasses = carcasseList.filter(
      (c) => !coupledIntermediairesByCarcasseId.has(c.zacharie_carcasse_id)
    );
    const coupledCarcasses = carcasseList.filter((c) =>
      coupledIntermediairesByCarcasseId.has(c.zacharie_carcasse_id)
    );

    // 2a. Carcasses sans intermédiaire couplé : chemin parallèle rapide.
    for (let i = 0; i < uncoupledCarcasses.length; i += CARCASSE_SYNC_CONCURRENCY) {
      const chunk = uncoupledCarcasses.slice(i, i + CARCASSE_SYNC_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (carcasseData) => {
          try {
            return await syncCarcasse(
              carcasseData.fei_numero,
              carcasseData.zacharie_carcasse_id,
              carcasseData as Prisma.CarcasseUncheckedCreateInput,
              user,
              {
                existingFei: carcasseFeiMap.get(carcasseData.fei_numero) ?? null,
                existingCarcasse: existingCarcasseMap.get(carcasseData.zacharie_carcasse_id) ?? null,
                ensuredRelationEntityIds,
              }
            );
          } catch (error) {
            capture(error as Error, {
              extra: {
                feiNumero: carcasseData.fei_numero,
                zacharieCarcasseId: carcasseData.zacharie_carcasse_id,
                userId: user.id,
              },
              user,
            });
            return null;
          }
        })
      );
      for (const result of chunkResults) {
        if (result) carcasseResults.push(result);
      }
    }

    // 2b. Carcasses AVEC intermédiaire(s) couplé(s) : carcasse + intermédiaires dans une même
    // transaction. Un throw (ex : intermediaire_entity_id vide) rollback le tout → l'ownership ne
    // bouge pas sans son CarcasseIntermediaire. Catch par transaction : un échec n'affecte pas les
    // autres carcasses.
    for (let i = 0; i < coupledCarcasses.length; i += COUPLED_TRANSACTION_CONCURRENCY) {
      const chunk = coupledCarcasses.slice(i, i + COUPLED_TRANSACTION_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (carcasseData) => {
          const coupled = coupledIntermediairesByCarcasseId.get(carcasseData.zacharie_carcasse_id) ?? [];
          try {
            return await prisma.$transaction(async (tx) => {
              const carcasseResult = await syncCarcasse(
                carcasseData.fei_numero,
                carcasseData.zacharie_carcasse_id,
                carcasseData as Prisma.CarcasseUncheckedCreateInput,
                user,
                {
                  existingFei: carcasseFeiMap.get(carcasseData.fei_numero) ?? null,
                  existingCarcasse: existingCarcasseMap.get(carcasseData.zacharie_carcasse_id) ?? null,
                  ensuredRelationEntityIds,
                  tx,
                }
              );
              const intermediaires: Array<Prisma.CarcasseIntermediaireGetPayload<object>> = [];
              for (const ciData of coupled) {
                intermediaires.push(
                  await syncCarcasseIntermediaire(
                    ciData.fei_numero,
                    ciData.intermediaire_id,
                    ciData.zacharie_carcasse_id,
                    ciData as Prisma.CarcasseIntermediaireUncheckedCreateInput,
                    tx
                  )
                );
              }
              return { carcasseResult, intermediaires };
            });
          } catch (error) {
            capture(error as Error, {
              extra: {
                feiNumero: carcasseData.fei_numero,
                zacharieCarcasseId: carcasseData.zacharie_carcasse_id,
                intermediaireIds: coupled.map((ci) => ci.intermediaire_id),
                userId: user.id,
                context: 'coupled_prise_en_charge',
              },
              user,
            });
            return null;
          }
        })
      );
      for (const result of chunkResults) {
        if (!result) continue;
        carcasseResults.push(result.carcasseResult);
        savedIntermediaires.push(...result.intermediaires);
      }
    }

    // 3. Process CarcassesIntermediaires NON couplés : leur carcasse n'est pas dans ce payload
    // (décision/annotation sur une carcasse déjà persistée). Les couplés ont été traités en 2b.
    for (const ciData of intermediairesList) {
      if (carcasseListIds.has(ciData.zacharie_carcasse_id)) continue;
      try {
        const saved = await syncCarcasseIntermediaire(
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

    // 4. Process CarcasseModificationRequests
    for (const modifData of carcasseModifRequests || []) {
      try {
        const { _approvalPayload, ...modifBody } = modifData as typeof modifData & {
          _approvalPayload?: Record<string, unknown>;
        };
        const result = await syncCarcasseModifRequest(
          modifBody as Prisma.CarcasseModificationRequestUncheckedCreateInput,
          user
        );
        modifResults.push({ ...result, approvalPayload: _approvalPayload });
      } catch (error) {
        capture(error as Error, {
          extra: { modifId: modifData.id, userId: user.id },
          user,
        });
      }
    }

    // 5. Process Logs
    // Les logs sont des entrées d'historique immuables à id généré côté client : un seul
    // createMany (skipDuplicates) au lieu d'un upsert par log. Log n'a aucune contrainte FK,
    // donc le batch ne peut pas échouer sur une carcasse/fiche manquante.
    const logsToSync = (logs || []).filter((l) => l.id);
    if (logsToSync.length > 0) {
      try {
        await prisma.log.createMany({
          data: logsToSync.map((logData) => ({
            id: logData.id,
            user_id: logData.user_id!,
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

    // Run side effects AFTER all saves (non-critical)
    for (const feiResult of feiResults) {
      try {
        if (!feiResult.isDeleted && feiResult.existingFei) {
          await runFeiUpdateSideEffects(feiResult.existingFei, feiResult.savedFei);
        }
      } catch (error) {
        capture(error as Error, {
          extra: { feiNumero: feiResult.savedFei.numero, context: 'fei_side_effects' },
          user,
        });
      }
    }

    // Modif-request side effects: apply Carcasse mutations on approve, notify on create/approve/reject.
    for (const r of modifResults) {
      try {
        await runCarcasseModifRequestSideEffects(r, r.approvalPayload);
      } catch (error) {
        capture(error as Error, {
          extra: { modifId: r.saved.id, context: 'modif_request_side_effects' },
          user,
        });
      }
    }

    // Refetch the carcasses touched by modif-request side effects (numero_bracelet or examinateur_signed_at changed).
    const touchedCarcasseIds = new Set<string>();
    for (const r of modifResults) {
      if (r.transitionedTo || r.justCancelled) touchedCarcasseIds.add(r.saved.zacharie_carcasse_id);
    }
    const refreshedCarcasses =
      touchedCarcasseIds.size > 0
        ? await prisma.carcasse.findMany({
            where: { zacharie_carcasse_id: { in: [...touchedCarcasseIds] } },
          })
        : [];
    // Override: refreshed carcasses replace any earlier carcasseResults output for the same id.
    const mergedCarcasses = new Map<string, Carcasse>();
    for (const cr of carcasseResults)
      mergedCarcasses.set(cr.savedCarcasse.zacharie_carcasse_id, cr.savedCarcasse);
    for (const rc of refreshedCarcasses) mergedCarcasses.set(rc.zacharie_carcasse_id, rc);

    // Fetch FEIs for response
    const feiNumeros = feiResults.map((f) => f.savedFei.numero);
    const feisFetched =
      feiNumeros.length > 0
        ? await prisma.fei.findMany({
            where: { numero: { in: feiNumeros } },
          })
        : [];

    res.status(200).send({
      ok: true,
      data: {
        feis: feisFetched,
        carcasses: [...mergedCarcasses.values()],
        carcassesIntermediaires: savedIntermediaires,
        carcasseModifRequests: modifResults.map((r) => r.saved),
        syncedLogIds,
      },
      error: '',
    });
  })
);

export default router;
