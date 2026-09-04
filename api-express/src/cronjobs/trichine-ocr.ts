import { capture } from '~/third-parties/sentry';
import { setupCronJob } from './utils';
import { analyserEmailsEntrantsEnAttente } from '~/utils/trichine-inbound-ocr';

export async function initTrichineOcrCron() {
  await Promise.resolve()
    .then(
      async () =>
        await setupCronJob({
          name: 'OCR des rapports trichine reçus par email',
          // toutes les 5 minutes : un résultat qui arrive 5 minutes plus tard ne change rien
          cronTime: '*/5 * * * *',
          job: ocrRapportsTrichine,
          runOnInit: false,
        })
    )
    .then(() => {
      console.log('Trichine OCR cron job is set up');
    })
    .catch(capture);
}

export async function ocrRapportsTrichine() {
  const traites = await analyserEmailsEntrantsEnAttente();
  if (traites) console.log(`OCR trichine : ${traites} message(s) analysé(s)`);
}
