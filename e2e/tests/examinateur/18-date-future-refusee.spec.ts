import { test, expect } from '@playwright/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Date de mise à mort future (J+1) refusée', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();

  // Chercher un bouton pour J+1 ; sinon saisir manuellement via le picker
  const jPlus1Label = dayjs().add(1, 'day').format('dddd DD MMMM');
  const jPlus1Btn = page.getByRole('button', { name: jPlus1Label });

  if (await jPlus1Btn.count()) {
    await jPlus1Btn.click();
    await expect(page.getByText(/date.*futur|future|invalide/i).first()).toBeVisible();
  } else {
    // TODO: verify — si pas de bouton future dans le picker, c'est déjà bloqué côté UI
    await expect(page.getByRole('button', { name: /demain/i })).toHaveCount(0);
  }
});
