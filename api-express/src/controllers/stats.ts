import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { getIframeUrl } from '~/service/metabase-embed';
import prisma from '~/prisma';
import { CarcasseType, CarcasseStatus, FeiOwnerRole } from '@prisma/client';
import dayjs from 'dayjs';

// BPH-related motifs (bonnes pratiques d'hygiène) for hygiene score calculation
// These are SVI lesion motifs that indicate hygiene issues attributable to the hunter
const BPH_RELATED_MOTIFS = [
  // Balle d'abdomen
  "Souillures d'origine digestive liées à une balle d'abdomen",
  // Souillures d'éviscération (includes balle d'abdomen non avérée)
  "Souillures d'origine digestive",
  // Souillures telluriques
  'Souillures autres que liées au contenu digestif : souillures telluriques',
  // Anomalies d'odeur
  'Odeur anormale',
  // Putréfaction
  'Putréfaction superficielle',
  'Putréfaction profonde',
  // Moisissures
  'Moisissures',
  // Œufs ou larves de mouche
  'Œufs ou larves de mouche',
  // Morsure de chien
  'Morsure de chien',
  // Viande à évolution anormale
  'Viande à évolution anormale : myopathie exsudative dépigmentaire',
  'Viande à évolution anormale : viande fiévreuse',
  'Viande à évolution anormale : viande surmenée',
];

/**
 * Count BPH-related lesions in a carcasse's SVI inspection results
 * Checks both IPM1 and IPM2 lesions
 */
function countBphLesions(carcasse: {
  svi_ipm1_lesions_ou_motifs: string[];
  svi_ipm2_lesions_ou_motifs: string[];
}): number {
  const allLesions = [...carcasse.svi_ipm1_lesions_ou_motifs, ...carcasse.svi_ipm2_lesions_ou_motifs];
  return allLesions.filter((lesion) => BPH_RELATED_MOTIFS.includes(lesion)).length;
}

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

    // Calculate hygiene score based on BPH (Bonnes Pratiques d'Hygiène)
    // Formula: 100 × (1 - (personal BPH seizure rate / (2 × national BPH seizure rate)))
    // Only considers carcasses sent to ETG (at least one intermediary was an ETG)

    // Find carcasses that went through an ETG (have at least one CarcasseIntermediaire with role ETG)
    const carcasseIdsWithEtg = await prisma.carcasseIntermediaire.findMany({
      where: {
        zacharie_carcasse_id: { in: carcasses.map((c) => c.zacharie_carcasse_id) },
        intermediaire_role: FeiOwnerRole.ETG,
        deleted_at: null,
      },
      select: {
        zacharie_carcasse_id: true,
      },
      distinct: ['zacharie_carcasse_id'],
    });
    const etgCarcasseIds = new Set(carcasseIdsWithEtg.map((c) => c.zacharie_carcasse_id));
    const carcassesSentToEtg = carcasses.filter((c) => etgCarcasseIds.has(c.zacharie_carcasse_id));
    const etgCarcassesCount = carcassesSentToEtg.length;

    // Count BPH-related lesions from SVI inspections for user's carcasses
    const personalBphLesionsCount = carcassesSentToEtg.reduce((count, c) => count + countBphLesions(c), 0);

    // Calculate personal BPH seizure rate
    const personalBphSeizureRate =
      etgCarcassesCount > 0 ? (personalBphLesionsCount / etgCarcassesCount) * 100 : 0;

    // Calculate national BPH seizure rate for the current season
    // Find all carcasses that went through an ETG this season
    const nationalEtgCarcasseIds = await prisma.carcasseIntermediaire.findMany({
      where: {
        intermediaire_role: FeiOwnerRole.ETG,
        deleted_at: null,
        CarcasseCarcasseIntermediaire: {
          date_mise_a_mort: {
            gte: seasonStart.toDate(),
            lte: seasonEnd.toDate(),
          },
          deleted_at: null,
        },
      },
      select: {
        zacharie_carcasse_id: true,
      },
      distinct: ['zacharie_carcasse_id'],
    });
    const nationalEtgIds = nationalEtgCarcasseIds.map((c) => c.zacharie_carcasse_id);

    const nationalEtgCarcasses = await prisma.carcasse.findMany({
      where: {
        zacharie_carcasse_id: { in: nationalEtgIds },
        deleted_at: null,
      },
      select: {
        svi_ipm1_lesions_ou_motifs: true,
        svi_ipm2_lesions_ou_motifs: true,
      },
    });

    const nationalBphLesionsCount = nationalEtgCarcasses.reduce((count, c) => count + countBphLesions(c), 0);
    const nationalEtgCount = nationalEtgCarcasses.length;
    const nationalBphSeizureRate =
      nationalEtgCount > 0 ? (nationalBphLesionsCount / nationalEtgCount) * 100 : 5; // Default 5% if no data

    // Calculate hygiene score
    // Score = 50 means equal to national average
    // Score > 50 means better than average
    // Score < 50 means worse than average
    let hygieneScore: number;
    if (etgCarcassesCount === 0) {
      // No carcasses sent to ETG, cannot calculate
      hygieneScore = 0;
    } else if (nationalBphSeizureRate === 0) {
      // No national BPH issues, perfect score if personal rate is also 0
      hygieneScore = personalBphSeizureRate === 0 ? 100 : 0;
    } else {
      // Formula: 100 × (1 - (personal rate / (2 × national rate)))
      hygieneScore = Math.round(100 * (1 - personalBphSeizureRate / (2 * nationalBphSeizureRate)));
      // Clamp between 0 and 100
      hygieneScore = Math.max(0, Math.min(100, hygieneScore));
    }

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
