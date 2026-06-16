import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { getIframeUrl } from '~/service/metabase-embed';
import prisma from '~/prisma';
import { CarcasseType, CarcasseStatus, DepotType, FeiOwnerRole, UserRoles } from '@prisma/client';
import validateUser from '~/middlewares/validateUser';
import departementsRegions from '~/data/departements-regions.json';
import {
  circuitCourtRoles,
  extractDepartementFromCommune,
  getCurrentSeason,
  hasBphMotif,
  resolveScope,
} from '~/utils/federation-stats';
import {
  matchBrucellose,
  matchPestePorcine,
  matchTuberculose,
  matchTularemie,
} from '~/utils/disease-suspicions';

const departementsLabels = (departementsRegions as { departements: Record<string, string> }).departements;

// Références nationales officielles (taux sur animaux présentés à l'inspection), pour comparer
// les statistiques personnelles du chasseur — mêmes bases que les taux personnels (carcasses SVI-éligibles).
const NATIONAL_SEIZURE_RATE_BIG_GAME = 13.75; // % taux de saisie national grand gibier sauvage
const NATIONAL_BPH_RATE_BIG_GAME = 5.49; // % taux BPH national grand gibier

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
    const { season, seasonStart, seasonEnd } = getCurrentSeason();

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
          nationalSeizureRate: NATIONAL_SEIZURE_RATE_BIG_GAME,
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

    // Hygiene score (BPH — Bonnes Pratiques d'Hygiène)
    // score = 100 × (1 − (personalBphRate / (2 × nationalBphRate)))
    // personalBphRate = (SVI-eligible + SAISIE + motif BPH) / SVI-eligible (aligned with admin /delta-bph).
    // nationalBphRate = référence officielle fixe NATIONAL_BPH_RATE_BIG_GAME (distincte du taux de saisie).
    const bphCarcasses = sviEligibleCarcasses.filter(
      (c) =>
        (c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
          c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE) &&
        hasBphMotif(c.svi_ipm2_lesions_ou_motifs)
    );

    const personalBphRate =
      sviEligibleCarcasses.length > 0 ? bphCarcasses.length / sviEligibleCarcasses.length : 0;
    const nationalBphRateFraction = NATIONAL_BPH_RATE_BIG_GAME / 100;

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
        nationalSeizureRate: NATIONAL_SEIZURE_RATE_BIG_GAME,
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

    const { isNational, scopeDepts, scope } = resolveScope(user);

    if (!isNational && (!scopeDepts || scopeDepts.length === 0)) {
      res.status(200).send({
        ok: true,
        data: {
          season: null,
          scope: 'departemental',
          scopeDepts: [],
          departements: [],
          totals: emptyValorisationTotals(),
        },
      });
      return;
    }

    const { season, seasonStart, seasonEnd } = getCurrentSeason();

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
    const totals = { gg: emptyBucket(), pg: emptyBucket() };

    for (const c of carcasses) {
      const dept = extractDepartementFromCommune(c.Fei?.commune_mise_a_mort);
      if (!dept) continue;
      if (scopeDepts && !scopeDepts.includes(dept)) continue;
      if (!c.type) continue;

      if (!stats.has(dept)) stats.set(dept, { gg: emptyBucket(), pg: emptyBucket() });
      const deptStats = stats.get(dept)!;
      const bucket = c.type === CarcasseType.GROS_GIBIER ? deptStats.gg : deptStats.pg;
      const totalBucket = c.type === CarcasseType.GROS_GIBIER ? totals.gg : totals.pg;

      const wasInEtg =
        c.premier_detenteur_depot_type === DepotType.ETG ||
        c.current_owner_role === FeiOwnerRole.ETG ||
        c.current_owner_role === FeiOwnerRole.SVI ||
        c.prev_owner_role === FeiOwnerRole.ETG ||
        c.prev_owner_role === FeiOwnerRole.SVI ||
        c.CarcasseIntermediaire.some((ci) => ci.intermediaire_role === FeiOwnerRole.ETG);

      if (c.consommateur_final_usage_domestique != null) {
        bucket.domestique++;
        totalBucket.domestique++;
      } else if (wasInEtg) {
        bucket.agree++;
        totalBucket.agree++;
      } else if (c.current_owner_role && circuitCourtRoles.includes(c.current_owner_role)) {
        bucket.nonAgree++;
        totalBucket.nonAgree++;
      }

      const isSviEligible = !c.next_owner_role || !circuitCourtRoles.includes(c.next_owner_role);
      if (isSviEligible) {
        bucket.sviEligible++;
        totalBucket.sviEligible++;
        if (
          c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
          c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE
        ) {
          bucket.seized++;
          totalBucket.seized++;
        }
        if (c.svi_carcasse_status !== null) {
          bucket.hasSviReturn = true;
          totalBucket.hasSviReturn = true;
        }
      }
    }

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

    const totalGg = totals.gg.agree + totals.gg.nonAgree + totals.gg.domestique;
    const totalPg = totals.pg.agree + totals.pg.nonAgree + totals.pg.domestique;

    res.status(200).send({
      ok: true,
      data: {
        season,
        scope,
        scopeDepts: scopeDepts ?? [],
        departements,
        totals: {
          ggAgree: totals.gg.agree,
          ggNonAgree: totals.gg.nonAgree,
          ggDomestique: totals.gg.domestique,
          ggTotal: totalGg,
          ggSeized: totals.gg.seized,
          ggSviEligible: totals.gg.sviEligible,
          ggTauxSaisie:
            totals.gg.sviEligible > 0 && totals.gg.hasSviReturn
              ? Math.round((totals.gg.seized / totals.gg.sviEligible) * 1000) / 10
              : null,
          pgAgree: totals.pg.agree,
          pgNonAgree: totals.pg.nonAgree,
          pgDomestique: totals.pg.domestique,
          pgTotal: totalPg,
          pgSeized: totals.pg.seized,
          pgSviEligible: totals.pg.sviEligible,
          pgTauxSaisie:
            totals.pg.sviEligible > 0 && totals.pg.hasSviReturn
              ? Math.round((totals.pg.seized / totals.pg.sviEligible) * 1000) / 10
              : null,
        },
      },
    });
  })
);

function emptyValorisationTotals() {
  return {
    ggAgree: 0,
    ggNonAgree: 0,
    ggDomestique: 0,
    ggTotal: 0,
    ggSeized: 0,
    ggSviEligible: 0,
    ggTauxSaisie: null as number | null,
    pgAgree: 0,
    pgNonAgree: 0,
    pgDomestique: 0,
    pgTotal: 0,
    pgSeized: 0,
    pgSviEligible: 0,
    pgTauxSaisie: null as number | null,
  };
}

router.get(
  '/federation/sanitaire',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.FDC, UserRoles.FRC, UserRoles.FNC]),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401);
      next(new Error('Utilisateur non authentifié'));
      return;
    }

    const { isNational, scopeDepts, scope } = resolveScope(user);

    if (!isNational && (!scopeDepts || scopeDepts.length === 0)) {
      res.status(200).send({
        ok: true,
        data: {
          season: null,
          scope: 'departemental',
          scopeDepts: [],
          departements: [],
          totals: { tuberculose: 0, pestePorcine: 0, brucellose: 0, tularemie: 0 },
        },
      });
      return;
    }

    const { season, seasonStart, seasonEnd } = getCurrentSeason();

    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        date_mise_a_mort: { gte: seasonStart.toDate(), lte: seasonEnd.toDate() },
      },
      select: {
        type: true,
        espece: true,
        examinateur_anomalies_carcasse: true,
        examinateur_anomalies_abats: true,
        Fei: { select: { commune_mise_a_mort: true } },
      },
    });

    type Bucket = { tuberculose: number; pestePorcine: number; brucellose: number; tularemie: number };
    const emptyBucket = (): Bucket => ({ tuberculose: 0, pestePorcine: 0, brucellose: 0, tularemie: 0 });

    const stats = new Map<string, Bucket>();
    const totals = emptyBucket();

    for (const c of carcasses) {
      const dept = extractDepartementFromCommune(c.Fei?.commune_mise_a_mort);
      if (!dept) continue;
      if (scopeDepts && !scopeDepts.includes(dept)) continue;

      if (!stats.has(dept)) stats.set(dept, emptyBucket());
      const deptStats = stats.get(dept)!;

      if (matchTuberculose(c)) {
        deptStats.tuberculose++;
        totals.tuberculose++;
      }
      if (matchPestePorcine(c)) {
        deptStats.pestePorcine++;
        totals.pestePorcine++;
      }
      if (matchBrucellose(c)) {
        deptStats.brucellose++;
        totals.brucellose++;
      }
      if (matchTularemie(c)) {
        deptStats.tularemie++;
        totals.tularemie++;
      }
    }

    const departements = Array.from(stats.entries())
      .map(([code, b]) => ({
        code,
        nom: departementsLabels[code] ?? code,
        tuberculose: b.tuberculose,
        pestePorcine: b.pestePorcine,
        brucellose: b.brucellose,
        tularemie: b.tularemie,
        total: b.tuberculose + b.pestePorcine + b.brucellose + b.tularemie,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    res.status(200).send({
      ok: true,
      data: {
        season,
        scope,
        scopeDepts: scopeDepts ?? [],
        departements,
        totals,
      },
    });
  })
);

router.get(
  '/federation/formation',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.FDC, UserRoles.FRC, UserRoles.FNC]),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401);
      next(new Error('Utilisateur non authentifié'));
      return;
    }

    const { isNational, scopeDepts, scope } = resolveScope(user);

    if (!isNational && (!scopeDepts || scopeDepts.length === 0)) {
      res.status(200).send({
        ok: true,
        data: {
          season: null,
          scope: 'departemental',
          scopeDepts: [],
          departements: [],
          national: { bphRate: 0, scoreBph: null, sviEligible: 0, bphCount: 0 },
          totals: { examinateursActifs: 0 },
        },
      });
      return;
    }

    const { season, seasonStart, seasonEnd } = getCurrentSeason();

    // Q1 — examinateurs actifs (≥1 FEI transmise sur la saison) par dept de prélèvement.
    const feis = await prisma.fei.findMany({
      where: {
        deleted_at: null,
        date_mise_a_mort: { gte: seasonStart.toDate(), lte: seasonEnd.toDate() },
        examinateur_initial_user_id: { not: null },
        examinateur_initial_date_approbation_mise_sur_le_marche: { not: null },
      },
      select: {
        examinateur_initial_user_id: true,
        commune_mise_a_mort: true,
      },
    });

    const examinateursByDept = new Map<string, Set<string>>();
    for (const f of feis) {
      const dept = extractDepartementFromCommune(f.commune_mise_a_mort);
      if (!dept) continue;
      if (scopeDepts && !scopeDepts.includes(dept)) continue;
      if (!f.examinateur_initial_user_id) continue;
      if (!examinateursByDept.has(dept)) examinateursByDept.set(dept, new Set());
      examinateursByDept.get(dept)!.add(f.examinateur_initial_user_id);
    }

    // Q2 — carcasses saison (national, non scopé) pour calculer le national BPH rate
    // utilisé en dénominateur du score, puis filtrer par scope pour les depts.
    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        date_mise_a_mort: { gte: seasonStart.toDate(), lte: seasonEnd.toDate() },
        type: CarcasseType.GROS_GIBIER,
      },
      select: {
        type: true,
        next_owner_role: true,
        svi_carcasse_status: true,
        svi_ipm2_lesions_ou_motifs: true,
        Fei: { select: { commune_mise_a_mort: true } },
      },
    });

    type DeptBph = { sviEligible: number; bphCount: number };
    const empty = (): DeptBph => ({ sviEligible: 0, bphCount: 0 });

    const byDept = new Map<string, DeptBph>();
    const national: DeptBph = empty();

    for (const c of carcasses) {
      const dept = extractDepartementFromCommune(c.Fei?.commune_mise_a_mort);
      if (!dept) continue;

      const isSviEligible = !c.next_owner_role || !circuitCourtRoles.includes(c.next_owner_role);
      if (!isSviEligible) continue;

      // National toujours : dénominateur scoreBph non scopé.
      national.sviEligible++;
      const isSeized =
        c.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
        c.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE;
      const isBph = isSeized && hasBphMotif(c.svi_ipm2_lesions_ou_motifs);
      if (isBph) national.bphCount++;

      if (scopeDepts && !scopeDepts.includes(dept)) continue;
      if (!byDept.has(dept)) byDept.set(dept, empty());
      const d = byDept.get(dept)!;
      d.sviEligible++;
      if (isBph) d.bphCount++;
    }

    const nationalBphRate = national.sviEligible > 0 ? national.bphCount / national.sviEligible : 0;
    const computeScore = (deptRate: number): number | null => {
      if (nationalBphRate === 0) return null;
      const raw = 100 * (1 - deptRate / (2 * nationalBphRate));
      return Math.max(0, Math.min(100, Math.round(raw)));
    };

    // Toutes les depts vues (examinateurs OU carcasses).
    const allDepts = new Set<string>([...examinateursByDept.keys(), ...byDept.keys()]);
    const departements = Array.from(allDepts)
      .map((code) => {
        const bph = byDept.get(code) ?? empty();
        const deptRate = bph.sviEligible > 0 ? bph.bphCount / bph.sviEligible : 0;
        return {
          code,
          nom: departementsLabels[code] ?? code,
          examinateursActifs: examinateursByDept.get(code)?.size ?? 0,
          tauxSaisieBph: bph.sviEligible > 0 ? Math.round(deptRate * 1000) / 10 : null, // % avec 1 décimale
          scoreBph: bph.sviEligible > 0 ? computeScore(deptRate) : null,
          sviEligible: bph.sviEligible,
          bphCount: bph.bphCount,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalExaminateurs = Array.from(examinateursByDept.values()).reduce((s, set) => s + set.size, 0);
    const nationalScoreBph = computeScore(nationalBphRate);

    res.status(200).send({
      ok: true,
      data: {
        season,
        scope,
        scopeDepts: scopeDepts ?? [],
        departements,
        national: {
          bphRate: Math.round(nationalBphRate * 1000) / 10,
          scoreBph: nationalScoreBph,
          sviEligible: national.sviEligible,
          bphCount: national.bphCount,
        },
        totals: {
          examinateursActifs: totalExaminateurs,
        },
      },
    });
  })
);

export default router;
