import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';
import type {
  AdminDashboardResponse,
  AdminSaisiesSviResponse,
  AdminPartsDeMarcheResponse,
  AdminDeltaBphResponse,
} from '~/types/responses';
import dayjs from 'dayjs';

router.get(
  '/dashboard',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminDashboardResponse>,
      next: express.NextFunction
    ) => {
      const dateFrom = (req.query.date_from as string) || null;
      const dateTo = (req.query.date_to as string) || null;

      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const defaultTo = now.toISOString().slice(0, 10);
      const from = dateFrom || defaultFrom;
      const to = dateTo || defaultTo;

      const [chasseursInscrits, compteValide, ficheOuverteRows, envoye1FicheRows] = await Promise.all([
        // Stage 1: Chasseurs inscrits
        prisma.user.count({
          where: { roles: { has: UserRoles.CHASSEUR }, deleted_at: null },
        }),
        // Stage 2: Compte validé (numero_cfei renseigné)
        prisma.user.count({
          where: {
            roles: { has: UserRoles.CHASSEUR },
            deleted_at: null,
            numero_cfei: { not: null },
            activated: true,
          },
        }),
        // Stage 3: Chasseurs avec >= 1 FEI créée (envoyée ou non)
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT u.id) as count
          FROM "User" u
          INNER JOIN "Fei" f ON (f.created_by_user_id = u.id OR f.examinateur_initial_user_id = u.id)
          WHERE 'CHASSEUR' = ANY(u.roles)
            AND u.deleted_at IS NULL
            AND f.deleted_at IS NULL
        `,
        // Stage 4+: Chasseurs avec >= 1 FEI envoyée (+ count pour stages 5, 6)
        prisma.$queryRaw<Array<{ user_id: string; fei_count: bigint }>>`
          SELECT u.id as user_id, COUNT(DISTINCT f.numero) as fei_count
          FROM "User" u
          INNER JOIN "Fei" f ON (f.created_by_user_id = u.id OR f.premier_detenteur_user_id = u.id)
          WHERE 'CHASSEUR' = ANY(u.roles)
            AND u.deleted_at IS NULL
            AND f.deleted_at IS NULL
            AND f.fei_prev_owner_user_id IS NOT NULL
          GROUP BY u.id
        `,
      ]);

      const envoye1 = envoye1FicheRows.length;
      const envoye2 = envoye1FicheRows.filter((r) => Number(r.fei_count) >= 2).length;
      const envoye3 = envoye1FicheRows.filter((r) => Number(r.fei_count) >= 3).length;

      // Cumulative funnel (each stage >= next)
      const ficheOuverte = Number(ficheOuverteRows[0]?.count ?? 0);
      const funnel = {
        chasseurs_inscrits: chasseursInscrits,
        compte_valide: compteValide,
        fiche_ouverte: ficheOuverte,
        envoye_1_fiche: envoye1,
        envoye_2_fiches: envoye2,
        envoye_3_fiches: envoye3,
      };

      // Inscriptions par semaine
      const inscriptionsParSemaine = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE_TRUNC('week', created_at) as date, COUNT(*) as count
        FROM "User"
        WHERE 'CHASSEUR' = ANY(roles)
          AND deleted_at IS NULL
          AND created_at >= ${new Date(from)}::date
          AND created_at < (${new Date(to)}::date + interval '1 day')
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY date ASC
      `;

      res.status(200).send({
        ok: true,
        data: {
          funnel,
          inscriptions_par_semaine: inscriptionsParSemaine.map((r) => ({
            date: new Date(r.date).toISOString().slice(0, 10),
            count: Number(r.count),
          })),
        },
        error: '',
      });
    }
  )
);

router.get(
  '/saisies-svi',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminSaisiesSviResponse>,
      next: express.NextFunction
    ) => {
      const [rows, tauxRows] = await Promise.all([
        prisma.$queryRaw<Array<{ motif: string; count: bigint }>>`
          SELECT motif, COUNT(*) as count
          FROM "Carcasse" c
          JOIN "Fei" f ON c.fei_numero = f.numero,
          LATERAL unnest(c.svi_ipm2_lesions_ou_motifs) AS motif
          WHERE c.deleted_at IS NULL
            AND c.svi_carcasse_status = 'SAISIE_TOTALE'
            AND NOT (f.created_by_user_id LIKE '%GLOP%')
          GROUP BY motif
          ORDER BY count DESC
        `,
        prisma.$queryRaw<
          Array<{ total_inspectees: bigint; total_saisies: bigint; total_mauvaises_pratiques: bigint }>
        >`
          SELECT
            COUNT(*) as total_inspectees,
            COUNT(*) FILTER (
              WHERE c.svi_carcasse_status = 'SAISIE_TOTALE'
            ) as total_saisies,
            COUNT(*) FILTER (
              WHERE c.svi_carcasse_status = 'SAISIE_TOTALE'
                AND EXISTS (
                  SELECT 1 FROM unnest(c.svi_ipm2_lesions_ou_motifs) m
                  WHERE m ILIKE ANY(ARRAY[
                    '%Souillures d''origine digestive liées à une balle d''abdomen%',
                    '%Souillures d''origine digestive%',
                    '%souillures telluriques%',
                    '%Odeur anormale%',
                    '%Putréfaction superficielle%',
                    '%Putréfaction profonde%',
                    '%Moisissures%',
                    '%Œufs ou larves de mouche%',
                    '%orsure de chien%',
                    '%Viande à évolution anormale%'
                  ])
                )
            ) as total_mauvaises_pratiques
          FROM "Carcasse" c
          JOIN "Fei" f ON c.fei_numero = f.numero
          WHERE c.deleted_at IS NULL
            AND f.svi_assigned_at IS NOT NULL
            AND c.svi_carcasse_status IN ('ACCEPTE', 'LEVEE_DE_CONSIGNE', 'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT')
            AND NOT (f.created_by_user_id LIKE '%GLOP%')
        `,
      ]);

      const mauvaisePratiquePatterns = [
        /souillures d'origine digestive/i,
        /souillures telluriques/i,
        /odeur anormale/i,
        /putréfaction superficielle/i,
        /putréfaction profonde/i,
        /moisissures/i,
        /œufs ou larves de mouche/i,
        /orsure de chien/i,
        /viande à évolution anormale/i,
      ];

      const totalInspectees = Number(tauxRows[0]?.total_inspectees ?? 0);
      const totalSaisies = Number(tauxRows[0]?.total_saisies ?? 0);
      const totalMauvaises = Number(tauxRows[0]?.total_mauvaises_pratiques ?? 0);

      res.status(200).send({
        ok: true,
        data: {
          motifs: rows.map((r) => ({
            motif: r.motif,
            count: Number(r.count),
            is_mauvaise_pratique: mauvaisePratiquePatterns.some((p) => p.test(r.motif)),
          })),
          total_inspectees: totalInspectees,
          total_saisies: totalSaisies,
          taux_saisie_global:
            totalInspectees > 0 ? Math.round((totalSaisies / totalInspectees) * 1000) / 10 : 0,
          total_mauvaises_pratiques: totalMauvaises,
          taux_mauvaises_pratiques:
            totalInspectees > 0 ? Math.round((totalMauvaises / totalInspectees) * 1000) / 10 : 0,
        },
        error: '',
      });
    }
  )
);

const POIDS_MOYEN_KG: Record<string, number> = {
  'Cerf élaphe': 80,
  'Cerf sika': 80,
  Chevreuil: 15,
  Daim: 40,
  Sanglier: 50,
  Chamois: 25,
  Isard: 25,
  'Mouflon méditerranéen': 30,
};
const POIDS_MOYEN_DEFAULT_KG = 1;

router.get(
  '/parts-de-marche',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminPartsDeMarcheResponse>,
      next: express.NextFunction
    ) => {
      const now = dayjs();
      const currentYear = now.year();
      const currentSeasonStart = now.month() < 6 ? currentYear - 1 : currentYear;

      // Day offset within current season (days since July 1)
      const seasonStartDate = dayjs(`${currentSeasonStart}-07-01`);
      const dayOffsetInSeason = now.diff(seasonStartDate, 'day');

      // Fetch all circuit-long carcasses grouped by season and species
      const rows = await prisma.$queryRaw<
        Array<{ season_start: number; espece: string; carcasse_count: bigint; nombre_total: bigint }>
      >`
        SELECT
          CASE
            WHEN EXTRACT(MONTH FROM c.date_mise_a_mort) >= 7
            THEN EXTRACT(YEAR FROM c.date_mise_a_mort)::int
            ELSE EXTRACT(YEAR FROM c.date_mise_a_mort)::int - 1
          END AS season_start,
          c.espece,
          COUNT(*) AS carcasse_count,
          COALESCE(SUM(c.nombre_d_animaux), COUNT(*)) AS nombre_total
        FROM "Carcasse" c
        INNER JOIN "CarcasseIntermediaire" ci ON ci.zacharie_carcasse_id = c.zacharie_carcasse_id
        INNER JOIN "Entity" e ON e.id = ci.intermediaire_entity_id
        WHERE c.deleted_at IS NULL
          AND c.date_mise_a_mort IS NOT NULL
          AND e.type IN ('ETG', 'COLLECTEUR_PRO')
        GROUP BY season_start, c.espece
      `;

      // Also fetch with date cutoff for potentiel calculation
      const rowsWithCutoff = await prisma.$queryRaw<
        Array<{ season_start: number; espece: string; carcasse_count: bigint; nombre_total: bigint }>
      >`
        SELECT
          CASE
            WHEN EXTRACT(MONTH FROM c.date_mise_a_mort) >= 7
            THEN EXTRACT(YEAR FROM c.date_mise_a_mort)::int
            ELSE EXTRACT(YEAR FROM c.date_mise_a_mort)::int - 1
          END AS season_start,
          c.espece,
          COUNT(*) AS carcasse_count,
          COALESCE(SUM(c.nombre_d_animaux), COUNT(*)) AS nombre_total
        FROM "Carcasse" c
        INNER JOIN "CarcasseIntermediaire" ci ON ci.zacharie_carcasse_id = c.zacharie_carcasse_id
        INNER JOIN "Entity" e ON e.id = ci.intermediaire_entity_id
        WHERE c.deleted_at IS NULL
          AND c.date_mise_a_mort IS NOT NULL
          AND e.type IN ('ETG', 'COLLECTEUR_PRO')
          AND c.date_mise_a_mort <= (
            MAKE_DATE(
              CASE
                WHEN EXTRACT(MONTH FROM c.date_mise_a_mort) >= 7
                THEN EXTRACT(YEAR FROM c.date_mise_a_mort)::int
                ELSE EXTRACT(YEAR FROM c.date_mise_a_mort)::int - 1
              END, 7, 1
            ) + ${dayOffsetInSeason} * INTERVAL '1 day'
          )
        GROUP BY season_start, c.espece
      `;

      // Calculate tonnage per season (full season = reel, with cutoff = for potentiel)
      function computeTonnage(data: typeof rows): Record<number, number> {
        const result: Record<number, number> = {};
        for (const row of data) {
          const poids = POIDS_MOYEN_KG[row.espece ?? ''] ?? POIDS_MOYEN_DEFAULT_KG;
          const tonnes = (Number(row.nombre_total) * poids) / 1000;
          result[row.season_start] = (result[row.season_start] ?? 0) + tonnes;
        }
        return result;
      }

      const tonnageFull = computeTonnage(rows);
      const tonnageCutoff = computeTonnage(rowsWithCutoff);

      // Build response: for each season, reel = cutoff tonnage, potentiel = previous season's cutoff tonnage
      const allSeasons = [...new Set([...Object.keys(tonnageFull).map(Number)])].sort();

      const circuit_long = allSeasons.map((seasonStart) => {
        const label = `${String(seasonStart).slice(2)}-${String(seasonStart + 1).slice(2)}`;
        return {
          saison: label,
          volume_reel: Math.round((tonnageCutoff[seasonStart] ?? 0) * 100) / 100,
          volume_potentiel: Math.round((tonnageCutoff[seasonStart - 1] ?? 0) * 100) / 100,
          volume_absolu: Math.round((tonnageFull[seasonStart] ?? 0) * 100) / 100,
        };
      });

      res.status(200).send({
        ok: true,
        data: { circuit_long },
        error: '',
      });
    }
  )
);

router.get(
  '/delta-bph',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminDeltaBphResponse>,
      next: express.NextFunction
    ) => {
      const rows = await prisma.$queryRaw<Array<{ delta: number }>>`
        WITH fei_scores AS (
          SELECT
            f.examinateur_initial_user_id,
            f.numero,
            100.0 - (
              COUNT(*) FILTER (
                WHERE c.svi_carcasse_status IN ('SAISIE_TOTALE'::"CarcasseStatus", 'SAISIE_PARTIELLE'::"CarcasseStatus")
                  AND EXISTS (
                    SELECT 1 FROM unnest(c.svi_ipm2_lesions_ou_motifs) m
                    WHERE m ILIKE ANY(ARRAY[
                      '%Souillures d''origine digestive%',
                      '%Souillures d''origine digestive liées à une balle d''abdomen%',
                      '%souillures telluriques%',
                      '%Odeur anormale%',
                      '%Putréfaction superficielle%',
                      '%Putréfaction profonde%',
                      '%Moisissures%',
                      '%Œufs ou larves de mouche%',
                      '%orsure de chien%',
                      '%Conditions de préparation des viandes par le producteur primaire%'
                    ])
                  )
              )::float / NULLIF(COUNT(*)::float, 0) * 100
            ) AS score_bph,
            ROW_NUMBER() OVER (
              PARTITION BY f.examinateur_initial_user_id
              ORDER BY COALESCE(f.date_mise_a_mort, f.created_at) ASC
            ) AS rn_asc,
            ROW_NUMBER() OVER (
              PARTITION BY f.examinateur_initial_user_id
              ORDER BY COALESCE(f.date_mise_a_mort, f.created_at) DESC
            ) AS rn_desc,
            COUNT(*) OVER (PARTITION BY f.examinateur_initial_user_id) AS total_feis
          FROM "Fei" f
          JOIN "Carcasse" c ON c.fei_numero = f.numero
          WHERE f.deleted_at IS NULL
            AND c.deleted_at IS NULL
            AND c.type = 'GROS_GIBIER'::"CarcasseType"
            AND (c.next_owner_role IS NULL OR c.next_owner_role NOT IN (
              'COMMERCE_DE_DETAIL'::"FeiOwnerRole",
              'REPAS_DE_CHASSE_OU_ASSOCIATIF'::"FeiOwnerRole",
              'CANTINE_OU_RESTAURATION_COLLECTIVE'::"FeiOwnerRole",
              'ASSOCIATION_CARITATIVE'::"FeiOwnerRole",
              'CONSOMMATEUR_FINAL'::"FeiOwnerRole"
            ))
            AND c.svi_carcasse_status IS NOT NULL
            AND NOT (f.created_by_user_id LIKE '%GLOP%')
          GROUP BY f.examinateur_initial_user_id, f.numero, f.date_mise_a_mort, f.created_at
        ),
        deltas AS (
          SELECT
            examinateur_initial_user_id,
            AVG(score_bph) FILTER (WHERE rn_desc <= 5) -
            AVG(score_bph) FILTER (WHERE rn_asc <= 5) AS delta
          FROM fei_scores
          WHERE total_feis >= 10
          GROUP BY examinateur_initial_user_id
        )
        SELECT ROUND(delta::numeric, 1)::float AS delta
        FROM deltas
        ORDER BY delta
      `;

      res.status(200).send({
        ok: true,
        data: { deltas: rows.map((r) => r.delta) },
        error: '',
      });
    }
  )
);

export default router;
