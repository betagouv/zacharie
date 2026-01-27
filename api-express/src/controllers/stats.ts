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
    const bigGameCarcasses = carcasses.filter((c) => c.type === CarcasseType.GROS_GIBIER);
    const bigGame = bigGameCarcasses.length;
    const smallGame = carcasses.filter((c) => c.type === CarcasseType.PETIT_GIBIER).length;

    // Get refusal causes from intermediaire refusals and SVI lesions/motifs
    const refusalCausesMap = new Map<string, number>();
    for (const carcasse of bigGameCarcasses) {
      // Intermediaire refusal motif
      if (carcasse.intermediaire_carcasse_refus_motif) {
        const motif = carcasse.intermediaire_carcasse_refus_motif;
        refusalCausesMap.set(motif, (refusalCausesMap.get(motif) || 0) + 1);
      }
      // SVI IPM1 and IPM2 lesions/motifs (deduplicated to avoid counting same motif twice)
      const sviMotifs = new Set([
        ...(carcasse.svi_ipm1_lesions_ou_motifs ?? []),
        ...(carcasse.svi_ipm2_lesions_ou_motifs ?? []),
      ]);
      for (const motif of sviMotifs) {
        refusalCausesMap.set(motif, (refusalCausesMap.get(motif) || 0) + 1);
      }
    }
    const refusalCauses = Array.from(refusalCausesMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 causes

    // Calculate personal seizure rate for big game carcasses
    const seizedBigGame = bigGameCarcasses.filter(
      (c) =>
        c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
        c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE,
    );
    const personalSeizureRate =
      bigGameCarcasses.length > 0 ? (seizedBigGame.length / bigGameCarcasses.length) * 100 : 0;

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

    // Calculate hygiene score based on BPH (Bonnes Pratiques d'Hygiène)
    // Formula: 100 × (1 - (personal seizure rate / (2 × national seizure rate)))
    // Score = 50 means equal to national average
    // Score > 50 means better than average
    // Score < 50 means worse than average
    let hygieneScore: number;
    if (bigGameCarcasses.length === 0) {
      // No big game carcasses, cannot calculate
      hygieneScore = 0;
    } else if (nationalSeizureRate === 0) {
      // No national seizures, perfect score if personal rate is also 0
      hygieneScore = personalSeizureRate === 0 ? 100 : 0;
    } else {
      // Formula: 100 × (1 - (personal rate / (2 × national rate)))
      hygieneScore = Math.round(100 * (1 - personalSeizureRate / (2 * nationalSeizureRate)));
      // Clamp between 0 and 100
      hygieneScore = Math.max(0, Math.min(100, hygieneScore));
    }

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
        // Calculation details for debugging
        calculationDetails: {
          seasonStart,
          seasonEnd,
          // Personal seizure rate calculation
          bigGameCarcassesCount: bigGameCarcasses.length,
          seizedBigGameCount: seizedBigGame,
          personalSeizureRateRaw: personalSeizureRate,
          // National seizure rate calculation
          nationalBigGame2024Count: nationalBigGame2024,
          nationalSeizedBigGame2024Count: nationalSeizedBigGame2024,
          nationalSeizureRateRaw: nationalSeizureRate,
          // Hygiene score calculation
          formula: '100 × (1 - (personalSeizureRate / (2 × nationalSeizureRate)))',
          divisor: 2 * nationalSeizureRate,
          ratio: nationalSeizureRate > 0 ? personalSeizureRate / (2 * nationalSeizureRate) : 0,
          hygieneScoreBeforeClamp:
            nationalSeizureRate > 0 ? 100 * (1 - personalSeizureRate / (2 * nationalSeizureRate)) : 0,
        },
      },
    });
  }),
);

export default router;
