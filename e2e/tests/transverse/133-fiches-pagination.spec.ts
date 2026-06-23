import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('CHASSEUR_MANY_FICHES');
});

// CHASSEUR_MANY_FICHES seeds 5 fiches "À compléter" for Pierre (premier-detenteur@example.fr).
// En mode test ITEMS_PER_PAGE vaut 3 (chasseur-fiches.tsx) → 2 pages (3 + 2).
// Régression visée : une `key` React non unique sur les cartes faisait que le contenu ne
// changeait pas en changeant de page. On vérifie donc que les fiches de la page 2 sont
// bien DIFFÉRENTES de celles de la page 1.
test('Pagination des fiches chasseur : la page 2 affiche d’autres fiches que la page 1', async ({
  page,
}) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const feiLinks = page.locator('a[href*="/app/chasseur/fei/ZACH-"]');

  // Page 1 : pleine (3 fiches sur 5).
  await expect(feiLinks).toHaveCount(3, { timeout: 15000 });
  const page1Hrefs = await feiLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));

  // Le contrôle de pagination est rendu dès qu'il y a plus d'une page.
  const page2Link = page.locator('a[title="Page 2"]');
  await expect(page2Link).toBeVisible();

  await page2Link.click();
  await expect(page).toHaveURL(/[?&]page=2/);

  // Page 2 : les 2 fiches restantes.
  await expect(feiLinks).toHaveCount(2, { timeout: 10000 });
  const page2Hrefs = await feiLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href')));

  // Aucune fiche de la page 1 ne doit réapparaître en page 2 (sinon la pagination/les keys
  // sont cassées et le contenu reste figé).
  for (const href of page2Hrefs) {
    expect(page1Hrefs).not.toContain(href);
  }
});
