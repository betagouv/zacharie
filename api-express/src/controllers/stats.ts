import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import { RequestWithUser } from '~/types/request';
import { getIframeUrl } from '~/service/metabase-embed';
import prisma from '~/prisma';
import {
  CarcasseType,
  CarcasseStatus,
  DepotType,
  FeiOwnerRole,
  UserRoles,
  EntityTypes,
  EntityRelationType,
  EntityRelationStatus,
  Prisma,
} from '@prisma/client';
import dayjs from 'dayjs';
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

async function getUserEntityIdsByType(userId: string, entityType: EntityTypes): Promise<string[]> {
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      EntityRelatedWithUser: { type: entityType },
    },
    select: { entity_id: true },
  });
  return relations.map((r) => r.entity_id);
}

router.get(
  '/svi',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.SVI]),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401);
      next(new Error('Utilisateur non authentifié'));
      return;
    }

    const userSviEntityIds = await getUserEntityIdsByType(user.id, EntityTypes.SVI);

    if (userSviEntityIds.length === 0) {
      res.status(200).send({
        ok: true,
        data: {
          upcoming: 0,
          toInspect: 0,
          volume7d: 0,
          volume30d: 0,
          carcassesByEspece: { gros: 0, petit: 0 },
        },
      });
      return;
    }

    const linkedEtgs = await prisma.entity.findMany({
      where: { type: EntityTypes.ETG, etg_linked_to_svi_id: { in: userSviEntityIds } },
      select: { id: true },
    });
    const linkedEtgIds = linkedEtgs.map((e) => e.id);

    const sevenDaysAgo = dayjs().subtract(7, 'day').toDate();
    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();

    const upcomingWhere: Prisma.FeiWhereInput = {
      deleted_at: null,
      svi_assigned_at: null,
      svi_closed_at: null,
      automatic_closed_at: null,
      intermediaire_closed_at: null,
      CarcasseIntermediaire: {
        some: {
          prise_en_charge_at: { not: null },
          intermediaire_entity_id: { in: linkedEtgIds },
        },
      },
    };

    const toInspectWhere: Prisma.FeiWhereInput = {
      deleted_at: null,
      svi_assigned_at: { not: null },
      svi_closed_at: null,
      automatic_closed_at: null,
      svi_entity_id: { in: userSviEntityIds },
    };

    const [upcoming, toInspect, volume7d, volume30d, activeFeis] = await Promise.all([
      linkedEtgIds.length > 0 ? prisma.fei.count({ where: upcomingWhere }) : 0,
      prisma.fei.count({ where: toInspectWhere }),
      prisma.fei.count({
        where: {
          deleted_at: null,
          svi_entity_id: { in: userSviEntityIds },
          svi_assigned_at: { gte: sevenDaysAgo },
        },
      }),
      prisma.fei.count({
        where: {
          deleted_at: null,
          svi_entity_id: { in: userSviEntityIds },
          svi_assigned_at: { gte: thirtyDaysAgo },
        },
      }),
      prisma.fei.findMany({
        where: {
          deleted_at: null,
          svi_closed_at: null,
          automatic_closed_at: null,
          OR: [...(linkedEtgIds.length > 0 ? [upcomingWhere] : []), toInspectWhere],
        },
        select: { numero: true },
      }),
    ]);

    const activeFeiNumeros = activeFeis.map((f) => f.numero);
    const [gros, petit] =
      activeFeiNumeros.length > 0
        ? await Promise.all([
            prisma.carcasse.count({
              where: {
                fei_numero: { in: activeFeiNumeros },
                type: CarcasseType.GROS_GIBIER,
                deleted_at: null,
              },
            }),
            prisma.carcasse.count({
              where: {
                fei_numero: { in: activeFeiNumeros },
                type: CarcasseType.PETIT_GIBIER,
                deleted_at: null,
              },
            }),
          ])
        : [0, 0];

    res.status(200).send({
      ok: true,
      data: {
        upcoming,
        toInspect,
        volume7d,
        volume30d,
        carcassesByEspece: { gros, petit },
      },
    });
  })
);

router.get(
  '/etg',
  passport.authenticate('user', { session: false }),
  validateUser([UserRoles.ETG]),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401);
      next(new Error('Utilisateur non authentifié'));
      return;
    }

    const userEtgEntityIds = await getUserEntityIdsByType(user.id, EntityTypes.ETG);

    if (userEtgEntityIds.length === 0) {
      res.status(200).send({
        ok: true,
        data: {
          toAccept: 0,
          ongoing: 0,
          volume7d: 0,
          volume30d: 0,
          carcassesByEspece: { gros: 0, petit: 0 },
          transmisSvi30d: 0,
          delaiAcceptationMsAvg: null,
          carcasses30d: 0,
          topEspeces: [],
          carcassesRefusees30d: 0,
          carcassesManquantes30d: 0,
          carcassesAnomalies30d: 0,
          premierDetenteursActifs30d: 0,
          topPremierDetenteurs: [],
          topEntitesChasse: [],
          delaiDecisionMsMedian: null,
          tauxAcceptation30d: 0,
          trendMensuel: [],
        },
      });
      return;
    }

    const sevenDaysAgo = dayjs().subtract(7, 'day').toDate();
    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();
    const sixMonthsAgo = dayjs().subtract(5, 'month').startOf('month').toDate();

    const toAcceptWhere: Prisma.FeiWhereInput = {
      deleted_at: null,
      automatic_closed_at: null,
      svi_assigned_at: null,
      intermediaire_closed_at: null,
      OR: [
        { fei_next_owner_entity_id: { in: userEtgEntityIds } },
        { Carcasses: { some: { next_owner_entity_id: { in: userEtgEntityIds } } } },
      ],
    };

    const ongoingWhere: Prisma.FeiWhereInput = {
      deleted_at: null,
      svi_assigned_at: null,
      svi_closed_at: null,
      automatic_closed_at: null,
      intermediaire_closed_at: null,
      CarcasseIntermediaire: {
        some: {
          prise_en_charge_at: { not: null },
          intermediaire_entity_id: { in: userEtgEntityIds },
        },
      },
    };

    const [toAccept, ongoing, volume7d, volume30d, activeFeis, inter6m] = await Promise.all([
      prisma.fei.count({ where: toAcceptWhere }),
      prisma.fei.count({ where: ongoingWhere }),
      prisma.fei.count({
        where: {
          deleted_at: null,
          CarcasseIntermediaire: {
            some: {
              prise_en_charge_at: { gte: sevenDaysAgo },
              intermediaire_entity_id: { in: userEtgEntityIds },
            },
          },
        },
      }),
      prisma.fei.count({
        where: {
          deleted_at: null,
          CarcasseIntermediaire: {
            some: {
              prise_en_charge_at: { gte: thirtyDaysAgo },
              intermediaire_entity_id: { in: userEtgEntityIds },
            },
          },
        },
      }),
      prisma.fei.findMany({
        where: {
          deleted_at: null,
          svi_closed_at: null,
          automatic_closed_at: null,
          OR: [toAcceptWhere, ongoingWhere],
        },
        select: { numero: true },
      }),
      prisma.carcasseIntermediaire.findMany({
        where: {
          intermediaire_entity_id: { in: userEtgEntityIds },
          prise_en_charge_at: { gte: sixMonthsAgo },
          deleted_at: null,
        },
        select: {
          zacharie_carcasse_id: true,
          fei_numero: true,
          prise_en_charge_at: true,
          decision_at: true,
          refus: true,
          manquante: true,
          CarcasseCarcasseIntermediaire: {
            select: {
              espece: true,
              examinateur_anomalies_carcasse: true,
              deleted_at: true,
            },
          },
          CarcasseIntermediaireFei: {
            select: {
              numero: true,
              examinateur_initial_date_approbation_mise_sur_le_marche: true,
              svi_assigned_at: true,
              premier_detenteur_user_id: true,
              premier_detenteur_entity_id: true,
              deleted_at: true,
            },
          },
        },
      }),
    ]);

    const activeFeiNumeros = activeFeis.map((f) => f.numero);
    const [gros, petit] =
      activeFeiNumeros.length > 0
        ? await Promise.all([
            prisma.carcasse.count({
              where: {
                fei_numero: { in: activeFeiNumeros },
                type: CarcasseType.GROS_GIBIER,
                deleted_at: null,
              },
            }),
            prisma.carcasse.count({
              where: {
                fei_numero: { in: activeFeiNumeros },
                type: CarcasseType.PETIT_GIBIER,
                deleted_at: null,
              },
            }),
          ])
        : [0, 0];

    const validInter = inter6m.filter(
      (i) =>
        i.CarcasseCarcasseIntermediaire?.deleted_at == null &&
        i.CarcasseIntermediaireFei?.deleted_at == null &&
        i.prise_en_charge_at != null
    );
    const inter30d = validInter.filter((i) => i.prise_en_charge_at! >= thirtyDaysAgo);

    const uniqueCarcassesById = new Map<string, (typeof inter30d)[number]>();
    for (const i of inter30d) {
      if (!uniqueCarcassesById.has(i.zacharie_carcasse_id)) {
        uniqueCarcassesById.set(i.zacharie_carcasse_id, i);
      }
    }
    const carcasses30d = uniqueCarcassesById.size;

    const especeCount = new Map<string, number>();
    for (const i of uniqueCarcassesById.values()) {
      const espece = i.CarcasseCarcasseIntermediaire?.espece || 'Non renseignée';
      especeCount.set(espece, (especeCount.get(espece) || 0) + 1);
    }
    const topEspeces = Array.from(especeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([espece, count]) => ({ espece, count }));

    const refused = new Set<string>();
    const missing = new Set<string>();
    const accepted = new Set<string>();
    const anomalies = new Set<string>();
    for (const i of inter30d) {
      if (i.refus) refused.add(i.zacharie_carcasse_id);
      if (i.manquante) missing.add(i.zacharie_carcasse_id);
      if (i.decision_at && !i.refus && !i.manquante) accepted.add(i.zacharie_carcasse_id);
      if ((i.CarcasseCarcasseIntermediaire?.examinateur_anomalies_carcasse?.length ?? 0) > 0) {
        anomalies.add(i.zacharie_carcasse_id);
      }
    }
    const carcassesRefusees30d = refused.size;
    const carcassesManquantes30d = missing.size;
    const carcassesAnomalies30d = anomalies.size;
    const carcassesAvecDecision = accepted.size + refused.size + missing.size;
    const tauxAcceptation30d =
      carcassesAvecDecision > 0 ? Math.round((accepted.size / carcassesAvecDecision) * 100) : 0;

    const uniqueFeis30d = new Map<
      string,
      { premier_detenteur_user_id: string | null; premier_detenteur_entity_id: string | null }
    >();
    for (const i of inter30d) {
      const fei = i.CarcasseIntermediaireFei;
      if (!fei) continue;
      if (!uniqueFeis30d.has(fei.numero)) {
        uniqueFeis30d.set(fei.numero, {
          premier_detenteur_user_id: fei.premier_detenteur_user_id,
          premier_detenteur_entity_id: fei.premier_detenteur_entity_id,
        });
      }
    }
    const pdUserCount = new Map<string, number>();
    const pdEntityCount = new Map<string, number>();
    for (const fei of uniqueFeis30d.values()) {
      if (fei.premier_detenteur_user_id) {
        pdUserCount.set(
          fei.premier_detenteur_user_id,
          (pdUserCount.get(fei.premier_detenteur_user_id) || 0) + 1
        );
      }
      if (fei.premier_detenteur_entity_id) {
        pdEntityCount.set(
          fei.premier_detenteur_entity_id,
          (pdEntityCount.get(fei.premier_detenteur_entity_id) || 0) + 1
        );
      }
    }
    const premierDetenteursActifs30d = pdUserCount.size;

    const topPdUserEntries = Array.from(pdUserCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topPdEntityEntries = Array.from(pdEntityCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const [topUsers, topEntities] = await Promise.all([
      topPdUserEntries.length > 0
        ? prisma.user.findMany({
            where: { id: { in: topPdUserEntries.map(([id]) => id) } },
            select: { id: true, prenom: true, nom_de_famille: true },
          })
        : Promise.resolve([]),
      topPdEntityEntries.length > 0
        ? prisma.entity.findMany({
            where: { id: { in: topPdEntityEntries.map(([id]) => id) } },
            select: { id: true, nom_d_usage: true, raison_sociale: true },
          })
        : Promise.resolve([]),
    ]);
    const userById = new Map(topUsers.map((u) => [u.id, u]));
    const entityById = new Map(topEntities.map((e) => [e.id, e]));

    const topPremierDetenteurs = topPdUserEntries.map(([userId, count]) => {
      const u = userById.get(userId);
      const nom = u
        ? `${u.prenom || ''} ${u.nom_de_famille || ''}`.trim() || 'Chasseur inconnu'
        : 'Chasseur inconnu';
      return { userId, nom, count };
    });
    const topEntitesChasse = topPdEntityEntries.map(([entityId, count]) => {
      const e = entityById.get(entityId);
      const nom = e ? e.nom_d_usage || e.raison_sociale || 'Entité inconnue' : 'Entité inconnue';
      return { entityId, nom, count };
    });

    const delaisAcceptation: number[] = [];
    const delaisDecision: number[] = [];
    const feiAcceptationSeen = new Set<string>();
    for (const i of inter30d) {
      const fei = i.CarcasseIntermediaireFei;
      const pec = i.prise_en_charge_at!;
      if (
        fei?.examinateur_initial_date_approbation_mise_sur_le_marche &&
        !feiAcceptationSeen.has(fei.numero)
      ) {
        const delta = pec.getTime() - fei.examinateur_initial_date_approbation_mise_sur_le_marche.getTime();
        if (delta > 0) {
          delaisAcceptation.push(delta);
          feiAcceptationSeen.add(fei.numero);
        }
      }
      if (i.decision_at) {
        const delta = i.decision_at.getTime() - pec.getTime();
        if (delta >= 0) delaisDecision.push(delta);
      }
    }
    const delaiAcceptationMsAvg =
      delaisAcceptation.length > 0
        ? Math.round(delaisAcceptation.reduce((a, b) => a + b, 0) / delaisAcceptation.length)
        : null;
    const delaiDecisionMsMedian = (() => {
      if (delaisDecision.length === 0) return null;
      const sorted = [...delaisDecision].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
    })();

    const transmisSvi30dFeis = new Set<string>();
    for (const i of validInter) {
      const fei = i.CarcasseIntermediaireFei;
      if (fei?.svi_assigned_at && fei.svi_assigned_at >= thirtyDaysAgo) {
        transmisSvi30dFeis.add(fei.numero);
      }
    }
    const transmisSvi30d = transmisSvi30dFeis.size;

    const trendBuckets = new Map<string, Set<string>>();
    for (let m = 5; m >= 0; m--) {
      const key = dayjs().subtract(m, 'month').format('YYYY-MM');
      trendBuckets.set(key, new Set());
    }
    for (const i of validInter) {
      const key = dayjs(i.prise_en_charge_at!).format('YYYY-MM');
      if (trendBuckets.has(key)) {
        trendBuckets.get(key)!.add(i.fei_numero);
      }
    }
    const trendMensuel = Array.from(trendBuckets.entries()).map(([mois, set]) => ({
      mois,
      count: set.size,
    }));

    res.status(200).send({
      ok: true,
      data: {
        toAccept,
        ongoing,
        volume7d,
        volume30d,
        carcassesByEspece: { gros, petit },
        transmisSvi30d,
        delaiAcceptationMsAvg,
        carcasses30d,
        topEspeces,
        carcassesRefusees30d,
        carcassesManquantes30d,
        carcassesAnomalies30d,
        premierDetenteursActifs30d,
        topPremierDetenteurs,
        topEntitesChasse,
        delaiDecisionMsMedian,
        tauxAcceptation30d,
        trendMensuel,
      },
    });
  })
);

export default router;
