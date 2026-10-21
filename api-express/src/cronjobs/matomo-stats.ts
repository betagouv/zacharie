import { capture } from '~/third-parties/sentry';
import { slidingWindow, syncMatomoStats } from '~/utils/matomo-stats';
import { setupCronJob } from './utils';

/*
 *
 * Import des statistiques Matomo dans Postgres, pour Metabase (cf doc/matomo.md).
 * Upsert idempotent de J-7 à J-1 : les jours déjà importés sont réécrits avec les chiffres consolidés.
 *
 */

export async function initMatomoStatsCron() {
  await Promise.resolve()
    .then(
      async () =>
        await setupCronJob({
          name: 'Import statistiques Matomo',
          // tous les jours à 6h15 (après le data health check de 6h)
          cronTime: '15 6 * * *',
          job: () => syncMatomoStats(slidingWindow()),
          runOnInit: false,
        })
    )
    .then(() => {
      console.log('Matomo stats cron job is set up');
    })
    .catch(capture);
}
