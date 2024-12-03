import prisma from '~/prisma';

export async function refreshMaterializedViews() {
  const queries = [
    // Index operations
    'DROP INDEX IF EXISTS carcasses_funnel_stats_stage_idx',
    'CREATE UNIQUE INDEX carcasses_funnel_stats_stage_idx ON carcasses_funnel_stats (stage)',

    'DROP INDEX IF EXISTS fei_stats_fei_numero_idx',
    'CREATE UNIQUE INDEX fei_stats_fei_numero_idx ON fei_stats(fei_numero)',

    'DROP INDEX IF EXISTS carcasse_intermediaire_refus_stats_status_idx',
    'CREATE UNIQUE INDEX carcasse_intermediaire_refus_stats_status_idx ON carcasse_intermediaire_refus_stats (status)',

    'DROP INDEX IF EXISTS carcasse_svi_stats_svi_carcasse_saisie_motif_idx',
    'CREATE UNIQUE INDEX carcasse_svi_stats_svi_carcasse_saisie_motif_idx ON carcasse_svi_stats (svi_carcasse_saisie_motif)',

    // View refresh operations
    'REFRESH MATERIALIZED VIEW carcasses_funnel_stats',
    'REFRESH MATERIALIZED VIEW fei_stats',
    'REFRESH MATERIALIZED VIEW carcasse_intermediaire_refus_stats',
    'REFRESH MATERIALIZED VIEW carcasse_svi_stats',
  ];

  try {
    for (const query of queries) {
      await prisma.$executeRawUnsafe(query);
    }
    console.log('Materialized views refreshed successfully');
  } catch (error) {
    console.error('Error refreshing materialized views:', error);
    throw error;
  }
}
