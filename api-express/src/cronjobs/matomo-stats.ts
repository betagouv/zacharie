import { capture } from '~/third-parties/sentry';
import { slidingWindow, syncMatomoStats } from '~/utils/matomo-stats';
import { setupCronJob } from './utils';

export async function initMatomoStatsCron() {
  await Promise.resolve()
    .then(
      async () =>
        await setupCronJob({
          name: 'Import statistiques Matomo',
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
