import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { getIframeUrl } from '~/service/metabase-embed';
import prisma from '~/prisma';
import { CarcasseType, CarcasseStatus } from '@prisma/client';
import dayjs from 'dayjs';

router.get(
  '/nombre-de-carcasses-cumule',
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    res.status(200).send({
      ok: true,
      data: {
        carcassesCumuleUrl: getIframeUrl(88),
        especesUrl: getIframeUrl(43),
        saisiesUrl: getIframeUrl(37),
      },
    });
  }),
);

router.get(
  '/mes-chasses',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401);
      next(new Error('Utilisateur non authentifié'));
      return;
    }

    // Calculate current season (hunting season typically runs from July to June)
    // Format: "25-26" means 2025-2026 season
    const now = dayjs();
    const currentYear = now.year();
    const seasonStartYear = now.month() >= 6 ? currentYear : currentYear - 1; // July (month 6) onwards
    const seasonEndYear = seasonStartYear + 1;
    const season = `${String(seasonStartYear).slice(-2)}-${String(seasonEndYear).slice(-2)}`;
    const seasonStart = dayjs(`${seasonStartYear}-07-01`).startOf('day');
    const seasonEnd = dayjs(`${seasonEndYear}-06-30`).endOf('day');

    // Get user's FEIs for the current season
    const feis = await prisma.fei.findMany({
      where: {
        OR: [{ examinateur_initial_user_id: user.id }, { premier_detenteur_user_id: user.id }],
        date_mise_a_mort: {
          gte: seasonStart.toDate(),
          lte: seasonEnd.toDate(),
        },
        deleted_at: null,
      },
      select: {
        numero: true,
      },
    });

    const feiNumeros = feis.map((fei) => fei.numero);

    if (feiNumeros.length === 0) {
      res.status(200).send({
        ok: true,
        data: {
          totalCarcasses: 0,
          season,
          bigGame: 0,
          smallGame: 0,
          hygieneScore: 0,
          refusalCauses: [],
          personalSeizureRate: 0,
          nationalSeizureRate: 10.44, // Default national average
        },
      });
      return;
    }

    // Get all carcasses for these FEIs
    const carcasses = await prisma.carcasse.findMany({
      where: {
        fei_numero: { in: feiNumeros },
        deleted_at: null,
      },
    });

    // Calculate total carcasses
    const totalCarcasses = carcasses.length;

    // Calculate big game vs small game
    const bigGame = carcasses.filter((c) => c.type === CarcasseType.GROS_GIBIER).length;
    const smallGame = carcasses.filter((c) => c.type === CarcasseType.PETIT_GIBIER).length;

    // Calculate hygiene score (based on examinateur anomalies)
    // Score = 100 - (number of carcasses with anomalies / total) * 100
    const carcassesWithAnomalies = carcasses.filter(
      (c) =>
        (c.examinateur_anomalies_carcasse && c.examinateur_anomalies_carcasse.length > 0) ||
        (c.examinateur_anomalies_abats && c.examinateur_anomalies_abats.length > 0),
    ).length;
    const hygieneScore =
      totalCarcasses > 0 ? Math.round(100 - (carcassesWithAnomalies / totalCarcasses) * 100) : 100;

    // Get refusal causes from intermediaire refusals
    const refusalCausesMap = new Map<string, number>();
    for (const carcasse of carcasses) {
      if (carcasse.intermediaire_carcasse_refus_motif) {
        const motif = carcasse.intermediaire_carcasse_refus_motif;
        refusalCausesMap.set(motif, (refusalCausesMap.get(motif) || 0) + 1);
      }
    }
    const refusalCauses = Array.from(refusalCausesMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 causes

    // Calculate personal seizure rate for big game
    const bigGameCarcasses = carcasses.filter((c) => c.type === CarcasseType.GROS_GIBIER);
    const seizedBigGame = bigGameCarcasses.filter(
      (c) =>
        c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
        c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE,
    ).length;
    const personalSeizureRate =
      bigGameCarcasses.length > 0 ? (seizedBigGame / bigGameCarcasses.length) * 100 : 0;

    // Calculate national seizure rate (all big game carcasses in 2024)
    const nationalBigGame2024 = await prisma.carcasse.count({
      where: {
        type: CarcasseType.GROS_GIBIER,
        date_mise_a_mort: {
          gte: dayjs('2024-01-01').toDate(),
          lte: dayjs('2024-12-31').toDate(),
        },
        deleted_at: null,
      },
    });

    const nationalSeizedBigGame2024 = await prisma.carcasse.count({
      where: {
        type: CarcasseType.GROS_GIBIER,
        date_mise_a_mort: {
          gte: dayjs('2024-01-01').toDate(),
          lte: dayjs('2024-12-31').toDate(),
        },
        deleted_at: null,
        OR: [
          { svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE },
          { svi_carcasse_status: CarcasseStatus.SAISIE_PARTIELLE },
        ],
      },
    });

    const nationalSeizureRate =
      nationalBigGame2024 > 0 ? (nationalSeizedBigGame2024 / nationalBigGame2024) * 100 : 10.44;

    res.status(200).send({
      ok: true,
      data: {
        totalCarcasses,
        season,
        bigGame,
        smallGame,
        hygieneScore,
        refusalCauses,
        personalSeizureRate: Math.round(personalSeizureRate * 10) / 10, // Round to 1 decimal
        nationalSeizureRate: Math.round(nationalSeizureRate * 100) / 100, // Round to 2 decimals
      },
    });
  }),
);

export default router;
