import prisma from '~/prisma';

// Directly in the DB, the folowing SQL query has been executed:
// CREATE OR REPLACE FUNCTION refresh_materialized_views_trigger()
// RETURNS TRIGGER AS $$
// BEGIN
//   REFRESH MATERIALIZED VIEW CONCURRENTLY carcasses_funnel_stats;
//   REFRESH MATERIALIZED VIEW CONCURRENTLY fei_stats;
//   REFRESH MATERIALIZED VIEW CONCURRENTLY carcasse_intermediaire_refus_stats;
//   REFRESH MATERIALIZED VIEW CONCURRENTLY carcasse_svi_stats;
//   RETURN NULL;
// END;
// $$ LANGUAGE plpgsql;

// -- Create triggers for each relevant table
// CREATE TRIGGER refresh_mat_views_fei
// AFTER INSERT OR UPDATE OR DELETE ON "Fei"
// FOR EACH STATEMENT
// EXECUTE FUNCTION refresh_materialized_views_trigger();

// CREATE TRIGGER refresh_mat_views_carcasse
// AFTER INSERT OR UPDATE OR DELETE ON "Carcasse"
// FOR EACH STATEMENT
// EXECUTE FUNCTION refresh_materialized_views_trigger();

// The next function is supperceded by the trigger above

// export async function refreshMaterializedViews() {
//   if (process.env.NODE_ENV !== 'development') {
//     const queries = [
//       // Index operations
//       'DROP INDEX IF EXISTS carcasses_funnel_stats_stage_idx',
//       'CREATE UNIQUE INDEX carcasses_funnel_stats_stage_idx ON carcasses_funnel_stats (stage)',

//       'DROP INDEX IF EXISTS fei_stats_fei_numero_idx',
//       'CREATE UNIQUE INDEX fei_stats_fei_numero_idx ON fei_stats(fei_numero)',

//       'DROP INDEX IF EXISTS carcasse_intermediaire_refus_stats_status_idx',
//       'CREATE UNIQUE INDEX carcasse_intermediaire_refus_stats_status_idx ON carcasse_intermediaire_refus_stats (status)',

//       'DROP INDEX IF EXISTS carcasse_svi_stats_svi_carcasse_saisie_motif_idx',
//       'CREATE UNIQUE INDEX carcasse_svi_stats_svi_carcasse_saisie_motif_idx ON carcasse_svi_stats (svi_carcasse_saisie_motif)',

//       // View refresh operations
//       'REFRESH MATERIALIZED VIEW IF EXISTS carcasses_funnel_stats',
//       'REFRESH MATERIALIZED VIEW IF EXISTS fei_stats',
//       'REFRESH MATERIALIZED VIEW IF EXISTS carcasse_intermediaire_refus_stats',
//       'REFRESH MATERIALIZED VIEW IF EXISTS carcasse_svi_stats',
//     ];

//     try {
//       for (const query of queries) {
//         await prisma.$executeRawUnsafe(query);
//       }
//       console.log('Materialized views refreshed successfully');
//     } catch (error) {
//       console.error('Error refreshing materialized views:', error);
//       throw error;
//     }
//   }
// }
