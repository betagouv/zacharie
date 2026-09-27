import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 140 — Périmètre des certificats SVI.
// Seed SVI_CONSIGNE : la fiche est assignée à SVI 1 (svi@example.fr) et la carcasse MM-001-001 a une
// décision IPM1 de mise en consigne signée, sans décision IPM2. Seul un SVI de l'entité assignée peut
// lister, lire ou générer ses certificats, et seulement le certificat qui correspond à sa décision.

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI_CONSIGNE');
});

const API_BASE = 'http://localhost:3291';
const feiId = 'ZACH-20250707-QZ6E0-185242';
const carcasseId = `${feiId}_MM-001-001`;

async function jwtCookie(page: Page) {
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === 'zacharie_express_jwt');
  expect(cookie, "pas de cookie JWT : la connexion n'a pas abouti").toBeTruthy();
  return `zacharie_express_jwt=${cookie!.value}`;
}

async function apiGet(page: Page, path: string) {
  return page.request.get(`${API_BASE}${path}`, { headers: { Cookie: await jwtCookie(page) } });
}

async function listeCertificats(page: Page) {
  const res = await apiGet(page, `/certificat/${carcasseId}/all`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data as Array<{ certificat_id: string; type: string }>;
}

// Connecté en svi@example.fr : génère le certificat de consigne par la route officielle.
async function genererConsigne(page: Page) {
  const res = await apiGet(page, `/certificat/carcasse/${carcasseId}/CC`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.data.certificat.type).toBe('CC');
  return body.data.certificat.certificat_id as string;
}

test("Le SVI de l'entité assignée génère, liste et lit le certificat de consigne", async ({ page }) => {
  await connectWith(page, 'svi@example.fr');
  const certificatId = await genererConsigne(page);

  // Une seconde demande renvoie le même certificat, sans en créer un nouveau
  expect(await genererConsigne(page)).toBe(certificatId);
  const certificats = await listeCertificats(page);
  expect(certificats.map((c) => c.certificat_id)).toEqual([certificatId]);

  const lecture = await apiGet(page, `/certificat/${certificatId}`);
  expect(lecture.status()).toBe(200);
  expect(lecture.headers()['content-type']).toContain('wordprocessingml');

  // Le certificat apparaît dans la section « Certificats » de la carcasse
  await page.getByRole('link', { name: feiId }).click();
  const carcasseBtn = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(page.getByText(`N° ${certificatId}`)).toBeVisible({ timeout: 10000 });
});

test("Un SVI d'une autre entité n'accède pas aux certificats de la carcasse", async ({ page }) => {
  await connectWith(page, 'svi@example.fr');
  const certificatId = await genererConsigne(page);

  await logoutAndConnect(page, 'svi-2@example.fr');
  expect((await apiGet(page, `/certificat/${carcasseId}/all`)).status()).toBe(404);
  expect((await apiGet(page, `/certificat/${certificatId}`)).status()).toBe(404);
  expect((await apiGet(page, `/certificat/carcasse/${carcasseId}/CC`)).status()).toBe(404);

  // La tentative de génération n'a rien créé
  await logoutAndConnect(page, 'svi@example.fr');
  const certificats = await listeCertificats(page);
  expect(certificats.map((c) => c.certificat_id)).toEqual([certificatId]);
});

test('Un certificat qui ne correspond pas à la décision SVI est refusé et non créé', async ({ page }) => {
  await connectWith(page, 'svi@example.fr');
  expect(await listeCertificats(page)).toHaveLength(0);

  // Pas de décision IPM2 : ni saisie totale ni levée de consigne
  for (const type of ['CST', 'LC']) {
    const res = await apiGet(page, `/certificat/carcasse/${carcasseId}/${type}`);
    expect(res.status()).toBe(400);
    expect((await res.json()).ok).toBe(false);
  }

  expect(await listeCertificats(page)).toHaveLength(0);
});

test('Un type de certificat inconnu est refusé', async ({ page }) => {
  await connectWith(page, 'svi@example.fr');
  const res = await apiGet(page, `/certificat/carcasse/${carcasseId}/INCONNU`);
  expect(res.status()).toBe(400);
  expect(await listeCertificats(page)).toHaveLength(0);
});

test("Un utilisateur non SVI n'accède pas aux certificats", async ({ page }) => {
  await connectWith(page, 'svi@example.fr');
  const certificatId = await genererConsigne(page);

  await logoutAndConnect(page, 'etg-1@example.fr');
  expect((await apiGet(page, `/certificat/${carcasseId}/all`)).status()).toBe(403);
  expect((await apiGet(page, `/certificat/${certificatId}`)).status()).toBe(403);
  expect((await apiGet(page, `/certificat/carcasse/${carcasseId}/CC`)).status()).toBe(403);
});
