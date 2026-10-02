import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Le chasseur modifie une carcasse hors ligne alors que la fiche est transmise à l'ETG ; pendant ce
// temps l'ETG la prend en charge. Au retour en ligne, le poste du chasseur renvoie la carcasse entière,
// avec la chaîne de transmission telle qu'il l'avait vue (encore chez lui) : le serveur ne doit pas
// annuler la prise en charge, mais doit garder la correction du chasseur.
test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  // fiche transmise à ETG 1, pas encore prise en charge, premier détenteur = examinateur initial
  await resetDb('ETG_PD_EXAMINATEUR');
});

test("Modification hors ligne du chasseur : la prise en charge faite entre-temps par l'ETG est conservée", async ({
  page,
  context,
  browser,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-165243';
  const carcasseId = `${feiId}_MM-001-004`;

  // Chasseur (mobile) : ouvre la fiche transmise, puis passe hors ligne.
  await connectWith(page, 'examinateur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const carcasseChasseur = page.getByRole('button', { name: /^Daim N° MM-001-004/ });
  await carcasseChasseur.scrollIntoViewIfNeeded();
  await expect(carcasseChasseur).toBeVisible({ timeout: 15000 });

  await context.setOffline(true);

  // Tant que l'ETG n'a pas pris en charge, l'examinateur peut encore corriger l'examen initial.
  await carcasseChasseur.click();
  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();
  await page.getByRole('button', { name: 'Système respiratoire (trachée, poumons)' }).click();
  await page.getByRole('button', { name: 'Abcès', exact: true }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer' }).click();

  // ETG (desktop, autre appareil) : prend la fiche en charge, en ligne.
  const etgContext = await browser.newContext();
  const etgPage = await etgContext.newPage();
  await connectWith(etgPage, 'etg-1@example.fr');
  await etgPage.getByRole('link', { name: feiId }).click();
  await expect(etgPage.getByText('Fiche reçue, pas encore prise en charge')).toBeVisible({ timeout: 15000 });
  const etgPriseEnChargeSync = etgPage.waitForResponse(
    (resp) =>
      resp.url().endsWith('/sync') &&
      resp.request().method() === 'POST' &&
      (resp.request().postData() ?? '').includes('"current_owner_role":"ETG"') &&
      resp.ok(),
    { timeout: 15000 }
  );
  const prendreEnCharge = etgPage.getByRole('button', { name: 'Prendre en charge' });
  await prendreEnCharge.scrollIntoViewIfNeeded();
  await prendreEnCharge.click();
  await expect(etgPage.getByText("Prise en charge par l'atelier")).toBeVisible({ timeout: 10000 });
  await etgPriseEnChargeSync;

  // Chasseur : retour en ligne, son poste pousse la carcasse modifiée hors ligne.
  const chasseurSync = page.waitForResponse(
    (resp) =>
      resp.url().endsWith('/sync') &&
      resp.request().method() === 'POST' &&
      (resp.request().postData() ?? '').includes(carcasseId) &&
      resp.ok(),
    { timeout: 15000 }
  );
  await context.setOffline(false);
  await chasseurSync;

  // ETG : rechargement complet depuis le serveur. La fiche est toujours prise en charge par l'atelier,
  // et la correction du chasseur est bien arrivée.
  await logoutAndConnect(etgPage, 'etg-1@example.fr');
  await etgPage.getByRole('link', { name: feiId }).click();
  await expect(etgPage.getByText("Prise en charge par l'atelier")).toBeVisible({ timeout: 15000 });
  await expect(etgPage.getByText('Fiche reçue, pas encore prise en charge')).toHaveCount(0);
  await expect(etgPage.getByRole('button', { name: 'Prendre en charge' })).toHaveCount(0);
  await expect(etgPage.getByRole('button', { name: /^Daim N° MM-001-004.*1 anomalie/ })).toBeVisible();

  await etgContext.close();
});
