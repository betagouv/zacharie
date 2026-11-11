import express from 'express';
import { z } from 'zod';
import { CarcasseType, Prisma, StatsRefCircuit, StatsRefIndicateur } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import { setAdminAuditChanges } from '~/middlewares/admin-audit-log';
import prisma from '~/prisma';
import type { AdminStatsRefResponse, AdminStatsRefsResponse } from '~/types/responses';

const router: express.Router = express.Router();

// Références nationales des KPI Metabase (volumes, objectifs, taux) : table de référence,
// la suppression est définitive (la trace reste dans le journal admin).

const STATS_REF_KEYS = ['saison', 'circuit', 'type_gibier', 'indicateur', 'valeur', 'source'];

const DOUBLON_MESSAGE =
  'Cette référence existe déjà pour cette saison, ce circuit, ce gibier et cet indicateur';

const statsRefSchema = z
  .object({
    saison: z
      .string({ required_error: 'La saison est obligatoire' })
      .regex(/^\d{4}-\d{4}$/, 'La saison doit être au format 2025-2026')
      .refine((saison) => Number(saison.slice(5)) === Number(saison.slice(0, 4)) + 1, {
        message: 'La saison doit couvrir deux années consécutives (ex. 2025-2026)',
      }),
    circuit: z.nativeEnum(StatsRefCircuit, { errorMap: () => ({ message: 'Circuit invalide' }) }),
    type_gibier: z.nativeEnum(CarcasseType, { errorMap: () => ({ message: 'Type de gibier invalide' }) }),
    indicateur: z.nativeEnum(StatsRefIndicateur, { errorMap: () => ({ message: 'Indicateur invalide' }) }),
    valeur: z
      .number({
        required_error: 'La valeur est obligatoire',
        invalid_type_error: 'La valeur doit être un nombre',
      })
      .finite('La valeur doit être un nombre')
      .min(0, 'La valeur doit être positive'),
    source: z
      .string()
      .trim()
      .nullish()
      .transform((source) => source || null),
  })
  .refine((body) => body.indicateur === StatsRefIndicateur.VOLUME_GLOBAL || body.valeur <= 100, {
    message: 'Un taux ou un objectif est un pourcentage : 100 au maximum',
    path: ['valeur'],
  });

function parseStatsRefBody(
  req: express.Request,
  res: express.Response<AdminStatsRefResponse>
): Prisma.StatsRefNationalCreateInput | null {
  const result = statsRefSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).send({ ok: false, data: { statsRef: null }, error: result.error.issues[0].message });
    return null;
  }
  const { saison, circuit, type_gibier, indicateur, valeur, source } = result.data;
  return { saison, circuit, type_gibier, indicateur, valeur, source };
}

function isDoublon(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

router.get(
  '/stats-ref',
  catchErrors(async (_req: express.Request, res: express.Response<AdminStatsRefsResponse>) => {
    const statsRefs = await prisma.statsRefNational.findMany({
      orderBy: [{ saison: 'desc' }, { indicateur: 'asc' }, { circuit: 'asc' }, { type_gibier: 'asc' }],
    });
    res.status(200).send({ ok: true, data: { statsRefs }, error: '' });
  })
);

router.post(
  '/stats-ref',
  catchErrors(async (req: express.Request, res: express.Response<AdminStatsRefResponse>) => {
    const body = parseStatsRefBody(req, res);
    if (!body) return;
    try {
      const statsRef = await prisma.statsRefNational.create({ data: body });
      res.status(200).send({ ok: true, data: { statsRef }, error: '' });
    } catch (error) {
      if (isDoublon(error)) {
        res.status(409).send({ ok: false, data: { statsRef: null }, error: DOUBLON_MESSAGE });
        return;
      }
      throw error;
    }
  })
);

router.put(
  '/stats-ref/:id',
  catchErrors(async (req: express.Request, res: express.Response<AdminStatsRefResponse>) => {
    const body = parseStatsRefBody(req, res);
    if (!body) return;
    const before = await prisma.statsRefNational.findUnique({ where: { id: req.params.id } });
    if (!before) {
      res.status(404).send({ ok: false, data: { statsRef: null }, error: 'Référence non trouvée' });
      return;
    }
    try {
      const statsRef = await prisma.statsRefNational.update({ where: { id: before.id }, data: body });
      setAdminAuditChanges(res, before, statsRef, STATS_REF_KEYS);
      res.status(200).send({ ok: true, data: { statsRef }, error: '' });
    } catch (error) {
      if (isDoublon(error)) {
        res.status(409).send({ ok: false, data: { statsRef: null }, error: DOUBLON_MESSAGE });
        return;
      }
      throw error;
    }
  })
);

router.delete(
  '/stats-ref/:id',
  catchErrors(async (req: express.Request, res: express.Response<AdminStatsRefResponse>) => {
    const statsRef = await prisma.statsRefNational.findUnique({ where: { id: req.params.id } });
    if (!statsRef) {
      res.status(404).send({ ok: false, data: { statsRef: null }, error: 'Référence non trouvée' });
      return;
    }
    await prisma.statsRefNational.delete({ where: { id: statsRef.id } });
    // le DELETE n'a pas de body : on garde les valeurs supprimées dans le journal
    setAdminAuditChanges(res, statsRef, {}, STATS_REF_KEYS);
    res.status(200).send({ ok: true, data: { statsRef: null }, error: '' });
  })
);

export default router;
