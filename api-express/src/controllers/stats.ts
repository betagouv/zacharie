import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { getIframeUrl } from '~/service/metabase-embed';
import prisma from '~/prisma';
import { CarcasseType, CarcasseStatus, DepotType, FeiOwnerRole, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import validateUser from '~/middlewares/validateUser';
import departementsRegions from '~/data/departements-regions.json';

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
  })
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
          hygieneScore: null,
          refusalCauses: [],
          personalSeizureRate: null,
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

    const circuitCourtRoles: FeiOwnerRole[] = [
      FeiOwnerRole.COMMERCE_DE_DETAIL,
      FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
      FeiOwnerRole.CANTINE_OU_RESTAURATION_COLLECTIVE,
      FeiOwnerRole.ASSOCIATION_CARITATIVE,
      FeiOwnerRole.CONSOMMATEUR_FINAL,
    ];
    const sviEligibleCarcasses = bigGameCarcasses.filter(
      (c) => !c.next_owner_role || !circuitCourtRoles.includes(c.next_owner_role)
    );
    const hasAnySviReturn = sviEligibleCarcasses.some((c) => c.svi_carcasse_status !== null);

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

    // Calculate personal seizure rate for SVI-eligible big game carcasses
    const seizedBigGame = sviEligibleCarcasses.filter(
      (c) =>
        c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
        c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE
    );
    const personalSeizureRate =
      sviEligibleCarcasses.length > 0 && hasAnySviReturn
        ? (seizedBigGame.length / sviEligibleCarcasses.length) * 100
        : sviEligibleCarcasses.length > 0
          ? null
          : null;

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

    // Hygiene score (BPH — Bonnes Pratiques d'Hygiène)
    // score = 100 × (1 − (personalBphRate / (2 × nationalBphRate)))
    // personalBphRate = (SVI-eligible + SAISIE + motif BPH) / SVI-eligible (aligned with admin /delta-bph).
    // nationalBphRate = nationalSeizureRate (same value).
    const BPH_PATTERNS = [
      "souillures d'origine digestive",
      'souillures telluriques',
      'odeur anormale',
      'putréfaction superficielle',
      'putréfaction profonde',
      'moisissures',
      'œufs ou larves de mouche',
      'morsure de chien',
      'viande à évolution anormale',
      'conditions de préparation des viandes par le producteur primaire',
      "souillures d’origine digestive liées à une balle d'abdomen",
      'souillures d’origine digestive',
    ];
    const hasBphMotif = (motifs: string[] | null) =>
      (motifs ?? []).some((m) => {
        const s = m.toLowerCase();
        return BPH_PATTERNS.some((p) => s.includes(p));
      });
    const bphCarcasses = sviEligibleCarcasses.filter(
      (c) =>
        (c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
          c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE) &&
        hasBphMotif(c.svi_ipm2_lesions_ou_motifs)
    );

    const personalBphRate =
      sviEligibleCarcasses.length > 0 ? bphCarcasses.length / sviEligibleCarcasses.length : 0;
    const nationalBphRateFraction = nationalSeizureRate / 100;

    let hygieneScoreRaw: number | null;
    let hygieneScore: number | null;
    if (sviEligibleCarcasses.length === 0 || !hasAnySviReturn || nationalBphRateFraction === 0) {
      hygieneScoreRaw = null;
      hygieneScore = null;
    } else {
      hygieneScoreRaw = 100 * (1 - personalBphRate / (2 * nationalBphRateFraction));
      hygieneScore = Math.max(0, Math.min(100, Math.round(hygieneScoreRaw)));
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
        personalSeizureRate: personalSeizureRate !== null ? Math.round(personalSeizureRate * 10) / 10 : null, // Round to 1 decimal
        nationalSeizureRate: Math.round(nationalSeizureRate * 100) / 100, // Round to 2 decimals
        // Calculation details for debugging
        calculationDetails: {
          // User & season
          userId: user.id,
          userEmail: user.email,
          season,
          seasonStart,
          seasonEnd,
          // FEIs
          feisCount: feis.length,
          feiNumeros,
          // Carcasses
          totalCarcassesCount: totalCarcasses,
          bigGameCount: bigGame,
          smallGameCount: smallGame,
          // SVI eligibility
          sviEligibleCount: sviEligibleCarcasses.length,
          hasAnySviReturn,
          // Refusal causes
          refusalCausesFull: Object.fromEntries(refusalCausesMap),
          // Personal seizure rate calculation
          bigGameCarcassesCount: bigGameCarcasses.length,
          seizedBigGameCount: seizedBigGame.length,
          personalSeizureRateRaw: personalSeizureRate,
          // National seizure rate calculation
          nationalBigGame2024Count: nationalBigGame2024,
          nationalSeizedBigGame2024Count: nationalSeizedBigGame2024,
          nationalSeizureRateRaw: nationalSeizureRate,
          // Hygiene score calculation (BPH)
          formula: '100 × (1 − (personalBphRate / (2 × nationalBphRate)))',
          bphCount: bphCarcasses.length,
          personalBphRate,
          nationalBphRateFraction,
          hygieneScoreRaw,
        },
      },
    });
  })
);

/**
 * Extrait le code département depuis le champ `Fei.commune_mise_a_mort`
 * (format attendu : "<code_postal> <COMMUNE>").
 *  - DOM/COM : 3 premiers chiffres (97x, 98x)
 *  - Corse : 2A si CP ≤ 20190, 2B sinon
 *  - Métropole : 2 premiers chiffres
 */
function extractDepartementFromCommune(commune: string | null | undefined): string | null {
  if (!commune) return null;
  const cp = commune.trim().split(/\s+/)[0];
  if (!cp || cp.length < 2 || !/^\d/.test(cp)) return null;
  if (cp.startsWith('97') || cp.startsWith('98')) return cp.slice(0, 3);
  if (cp.startsWith('20')) {
    const num = parseInt(cp, 10);
    if (!Number.isFinite(num)) return null;
    return num <= 20190 ? '2A' : '2B';
  }
  return cp.slice(0, 2);
}

router.get(
  '/federation/valorisation',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.FDC, UserRoles.FRC, UserRoles.FNC]),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401);
      next(new Error('Utilisateur non authentifié'));
      return;
    }

    // Scope géographique lu directement sur le user.
    // FNC → scope national (toutes les depts), peu importe le contenu de scope_departements_codes.
    // FRC/FDC → liste explicite des depts à afficher.
    const isNational = user.roles.includes(UserRoles.FNC);
    const scopeDepts: string[] | null = isNational ? null : (user.scope_departements_codes ?? []);

    if (!isNational && (!scopeDepts || scopeDepts.length === 0)) {
      res.status(200).send({
        ok: true,
        data: { season: null, scope: 'departemental', scopeDepts: [], departements: [] },
      });
      return;
    }

    // Saison de chasse en cours (1er juillet → 30 juin), comme le dashboard chasseur.
    const now = dayjs();
    const seasonStartYear = now.month() >= 6 ? now.year() : now.year() - 1;
    const seasonEndYear = seasonStartYear + 1;
    const season = `${String(seasonStartYear).slice(-2)}-${String(seasonEndYear).slice(-2)}`;
    const seasonStart = dayjs(`${seasonStartYear}-07-01`).startOf('day');
    const seasonEnd = dayjs(`${seasonEndYear}-06-30`).endOf('day');

    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        date_mise_a_mort: { gte: seasonStart.toDate(), lte: seasonEnd.toDate() },
      },
      include: {
        Fei: { select: { commune_mise_a_mort: true } },
        CarcasseIntermediaire: { select: { intermediaire_role: true } },
      },
    });

    // Carcasses transmises en circuit court : exclues du dénominateur du taux de saisie sanitaire,
    // identique au dashboard chasseur (cf. /stats/mes-chasses).
    const circuitCourtRoles: FeiOwnerRole[] = [
      FeiOwnerRole.COMMERCE_DE_DETAIL,
      FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
      FeiOwnerRole.CANTINE_OU_RESTAURATION_COLLECTIVE,
      FeiOwnerRole.ASSOCIATION_CARITATIVE,
      FeiOwnerRole.CONSOMMATEUR_FINAL,
    ];

    type Bucket = {
      agree: number;
      nonAgree: number;
      domestique: number;
      sviEligible: number;
      seized: number;
      hasSviReturn: boolean;
    };
    const emptyBucket = (): Bucket => ({
      agree: 0,
      nonAgree: 0,
      domestique: 0,
      sviEligible: 0,
      seized: 0,
      hasSviReturn: false,
    });

    const stats = new Map<string, { gg: Bucket; pg: Bucket }>();

    for (const c of carcasses) {
      const dept = extractDepartementFromCommune(c.Fei?.commune_mise_a_mort);
      if (!dept) continue;
      if (scopeDepts && !scopeDepts.includes(dept)) continue;
      if (!c.type) continue;

      if (!stats.has(dept)) stats.set(dept, { gg: emptyBucket(), pg: emptyBucket() });
      const deptStats = stats.get(dept)!;
      const bucket = c.type === CarcasseType.GROS_GIBIER ? deptStats.gg : deptStats.pg;

      // Circuit de valorisation
      const wasInEtg =
        c.premier_detenteur_depot_type === DepotType.ETG ||
        c.current_owner_role === FeiOwnerRole.ETG ||
        c.current_owner_role === FeiOwnerRole.SVI ||
        c.prev_owner_role === FeiOwnerRole.ETG ||
        c.prev_owner_role === FeiOwnerRole.SVI ||
        c.CarcasseIntermediaire.some((ci) => ci.intermediaire_role === FeiOwnerRole.ETG);

      if (c.consommateur_final_usage_domestique != null) {
        bucket.domestique++;
      } else if (wasInEtg) {
        bucket.agree++;
      } else if (c.current_owner_role && circuitCourtRoles.includes(c.current_owner_role)) {
        bucket.nonAgree++;
      }

      // Taux de saisie sanitaire : exclure circuit court (cohérent avec dashboard chasseur)
      const isSviEligible = !c.next_owner_role || !circuitCourtRoles.includes(c.next_owner_role);
      if (isSviEligible) {
        bucket.sviEligible++;
        if (
          c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
          c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE
        ) {
          bucket.seized++;
        }
        if (c.svi_carcasse_status !== null) bucket.hasSviReturn = true;
      }
    }

    const departementsLabels = (departementsRegions as { departements: Record<string, string> }).departements;

    const formatBucket = (b: Bucket) => ({
      agree: b.agree,
      nonAgree: b.nonAgree,
      domestique: b.domestique,
      tauxSaisie:
        b.sviEligible > 0 && b.hasSviReturn ? Math.round((b.seized / b.sviEligible) * 1000) / 10 : null,
    });

    const departements = Array.from(stats.entries())
      .map(([code, s]) => ({
        code,
        nom: departementsLabels[code] ?? code,
        gg: formatBucket(s.gg),
        pg: formatBucket(s.pg),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const scope = isNational
      ? 'national'
      : (scopeDepts as string[]).length === 1
        ? 'departemental'
        : 'regional';

    res.status(200).send({
      ok: true,
      data: {
        season,
        scope,
        scopeDepts: scopeDepts ?? [],
        departements,
      },
    });
  })
);

export default router;
