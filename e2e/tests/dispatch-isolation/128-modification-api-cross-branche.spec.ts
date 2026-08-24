import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 128 — Écriture cross-branche via l'API.
// Dispatch 2+2 vers ETG 1 et ETG 2, puis, connecté en ETG 1, tentative d'écriture sur une carcasse
// de la branche ETG 2.
//
// La cible a changé : ce spec visait `POST /carcasse/:feiNumero/:zacharieCarcasseId`, qui n'existe
// plus — toutes les écritures de carcasse passent par `/sync`. Il était `skip` en attendant que le
// backend pose un contrôle de propriété ; c'est fait, et il garde maintenant les deux moitiés du
// contrat :
//   - le refus est effectif ET remonté par item dans `data.rejected`, pour que le client cesse de
//     repousser au lieu de boucler indéfiniment sur un `is_synced = false` ;
//   - une écriture légitime de la même forme passe toujours (pas de faux refus), et une erreur
//     technique reste absente de `rejected` donc réessayable.

test.setTimeout(180_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

const API_BASE = 'http://localhost:3291';
const feiId = 'ZACH-20250707-QZ6E0-155242';

async function jwtCookie(page: import('@playwright/test').Page) {
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === 'zacharie_express_jwt');
  expect(cookie, "pas de cookie JWT : la connexion n'a pas abouti").toBeTruthy();
  return `zacharie_express_jwt=${cookie!.value}`;
}

// Les carcasses visibles de la fiche pour l'utilisateur connecté : c'est le périmètre de lecture,
// que l'écriture doit désormais épouser exactement.
async function getCarcasses(page: import('@playwright/test').Page, cookie: string) {
  // GET /carcasse est paginé et exige les 4 paramètres, comme le fait le client (load-carcasses.ts).
  const res = await page.request.get(`${API_BASE}/carcasse`, {
    headers: { Cookie: cookie },
    params: { page: '0', after: '0', limit: '5000', withDeleted: 'true' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return (body.data?.carcasses ?? []) as Array<{ fei_numero: string; zacharie_carcasse_id: string }>;
}

async function carcassesVisibles(page: import('@playwright/test').Page, cookie: string) {
  const carcasses = await getCarcasses(page, cookie);
  return carcasses.filter((c) => c.fei_numero === feiId).map((c) => c.zacharie_carcasse_id);
}

async function sync(page: import('@playwright/test').Page, cookie: string, body: object) {
  const res = await page.request.post(`${API_BASE}/sync`, {
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: JSON.stringify(body),
  });
  return { status: res.status(), body: await res.json() };
}

test("Écriture /sync sur une carcasse d'une autre branche → refusée et reportée", async ({ page }) => {
  // 1. Le PD dispatche 2+2 vers ETG 1 et ETG 2 (viewport mobile)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  const ajouterBtn = page.getByRole('button', { name: 'Ajouter un autre destinataire' });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  const group2 = page.locator('div.rounded.border').nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: 'N°' });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();

  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 2 - 75000 Paris (' }).click();
  const g2Stockage = group2.getByText('Pas de stockage').first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText('Je transporte les carcasses moi').first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 2 prend en charge, puis on relève son périmètre
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });
  const perimetreEtg2 = await carcassesVisibles(page, await jwtCookie(page));

  // 3. ETG 1 prend en charge sa branche, puis on relève son périmètre
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });
  const cookieEtg1 = await jwtCookie(page);
  const perimetreEtg1 = await carcassesVisibles(page, cookieEtg1);

  // On déduit les cibles des périmètres réels plutôt que de coder en dur des numéros de marquage :
  // l'ordre du dispatch a déjà changé une fois et avait laissé ce spec avec un commentaire faux.
  const carcasseAutreBranche = perimetreEtg2.find((id) => !perimetreEtg1.includes(id));
  const carcasseSienne = perimetreEtg1[0];
  expect(carcasseAutreBranche, 'le dispatch 2+2 devrait laisser des carcasses hors périmètre').toBeTruthy();
  expect(carcasseSienne, "l'ETG 1 devrait avoir ses propres carcasses").toBeTruthy();

  // 4. ETG 1 tente d'écrire sur la carcasse de la branche ETG 2
  const attaque = await sync(page, cookieEtg1, {
    carcasses: [
      { fei_numero: feiId, zacharie_carcasse_id: carcasseAutreBranche, heure_evisceration: '23:59' },
    ],
  });

  expect(attaque.status).toBe(200);
  expect(attaque.body.data.rejected).toEqual([
    {
      kind: 'carcasse',
      id: carcasseAutreBranche,
      reason: "Vous n'avez pas accès à cette carcasse",
    },
  ]);
  // Rien n'est renvoyé pour cette carcasse : ce serait exposer la branche d'en face.
  expect(attaque.body.data.carcasses).toEqual([]);

  // 5. L'écriture n'a pas eu lieu : ETG 2 relit et retrouve sa valeur d'origine
  await logoutAndConnect(page, 'etg-2@example.fr');
  const relecture = await getCarcasses(page, await jwtCookie(page));
  const carcasseApres = relecture.find(
    (c: { zacharie_carcasse_id: string }) => c.zacharie_carcasse_id === carcasseAutreBranche
  ) as { heure_evisceration?: string };
  expect(carcasseApres.heure_evisceration).not.toBe('23:59');

  // 6. Contrôle anti-faux-refus : la même écriture, sur sa propre carcasse, passe
  await logoutAndConnect(page, 'etg-1@example.fr');
  const cookieEtg1Bis = await jwtCookie(page);
  const legitime = await sync(page, cookieEtg1Bis, {
    carcasses: [{ fei_numero: feiId, zacharie_carcasse_id: carcasseSienne, heure_evisceration: '23:59' }],
  });

  expect(legitime.body.data.rejected).toEqual([]);
  expect(legitime.body.data.carcasses).toHaveLength(1);
  expect(legitime.body.data.carcasses[0].heure_evisceration).toBe('23:59');

  // 7. Une erreur technique n'est PAS un refus : elle reste hors de `rejected` pour que le client
  // réessaie. Sans cette distinction, un aléa côté base ferait abandonner la saisie de l'utilisateur.
  const transitoire = await sync(page, cookieEtg1Bis, {
    carcasses: [{ fei_numero: 'ZACH-FICHE-INEXISTANTE', zacharie_carcasse_id: 'ZC-INEXISTANTE' }],
  });

  expect(transitoire.status).toBe(200);
  expect(transitoire.body.data.rejected).toEqual([]);
});
