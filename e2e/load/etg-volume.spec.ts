import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { connectWith } from '../utils/connect-with';

// Mesure l'app d'un ETG avec un gros historique. Lancer d'abord load/populate-volume.ts avec le même
// CARCASSES. Chaque étape note : la durée, le temps bloqué par les tâches longues (> 50 ms) du thread
// principal, la plus longue d'entre elles, et la mémoire JS.
const CARCASSES = Number(process.env.CARCASSES ?? 10000);
const CARCASSES_PAR_FICHE = 4;
const COPIES = Math.ceil(CARCASSES / CARCASSES_PAR_FICHE) - 1;
const FICHES = COPIES + 1;
const TOTAL = FICHES * CARCASSES_PAR_FICHE;
const FICHE_MODELE = 'ZACH-20250707-QZ6E0-205242';
const STEP_TIMEOUT = 2 * 60 * 60 * 1000;

type Mesure = {
  etape: string;
  duree_s: number;
  bloque_s: number;
  tache_max_ms: number;
  memoire_js_mo: number;
};
const mesures: Array<Mesure> = [];

async function mesurer(page: Page, cdp: CDPSession, etape: string, action: () => Promise<void>) {
  console.log(`${etape}…`);
  await page.evaluate(() => ((window as unknown as { __longTasks: number[] }).__longTasks = []));
  const start = Date.now();
  await action();
  const duree = Date.now() - start;
  const longTasks = await page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks);
  const { metrics } = await cdp.send('Performance.getMetrics');
  const heap = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
  const mesure = {
    etape,
    duree_s: Math.round(duree / 100) / 10,
    bloque_s: Math.round(longTasks.reduce((a, b) => a + b, 0) / 100) / 10,
    tache_max_ms: Math.round(Math.max(0, ...longTasks)),
    memoire_js_mo: Math.round(heap / 1024 / 1024),
  };
  mesures.push(mesure);
  console.log(JSON.stringify(mesure));
}

test(`ETG avec ${TOTAL} carcasses`, async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  // le compteur de fiches n'apparaît qu'une fois toutes les données chargées dans le store
  const totalBadge = page.getByText(`${FICHES} fiches`, { exact: true }).filter({ visible: true }).first();

  console.log('connexion…');
  await connectWith(page, 'etg-1@example.fr');
  console.log('connecté');

  await mesurer(page, cdp, 'premier chargement (téléchargement complet)', async () => {
    await expect(totalBadge).toBeVisible({ timeout: STEP_TIMEOUT });
  });

  // Après le téléchargement, le store écrit tous les enregistrements dans IndexedDB en une transaction.
  // Une transaction en lecture seule n'obtient la main qu'une fois cette écriture terminée.
  await mesurer(page, cdp, 'écriture dans IndexedDB (après le chargement)', async () => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('keyval-store');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const transaction = request.result.transaction('keyval', 'readonly');
            transaction.objectStore('keyval').count();
            transaction.oncomplete = () => resolve();
          };
        })
    );
  });

  await mesurer(page, cdp, 'rechargement de la page (IndexedDB)', async () => {
    await page.reload();
    await expect(totalBadge).toBeVisible({ timeout: STEP_TIMEOUT });
  });

  await mesurer(page, cdp, 'fiches : page suivante', async () => {
    await page.getByRole('link', { name: 'Page suivante' }).first().click();
    await expect(page).toHaveURL(/page=2/, { timeout: STEP_TIMEOUT });
    await expect(page.locator('a[href*="/app/etg/fei/"]').first()).toBeVisible({ timeout: STEP_TIMEOUT });
  });

  const ficheCherchee = `${FICHE_MODELE}-${COPIES}`;
  await mesurer(page, cdp, 'fiches : recherche d’une fiche', async () => {
    await page.getByPlaceholder('Rechercher une fiche, un marquage...').fill(ficheCherchee);
    await expect(page.getByText('1 fiche', { exact: true }).filter({ visible: true }).first()).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
  });

  await mesurer(page, cdp, 'ouverture d’une fiche', async () => {
    await page.locator(`a[href*="/app/etg/fei/${ficheCherchee}"]`).first().click();
    await expect(page.getByText('MM-001-004').first()).toBeVisible({ timeout: STEP_TIMEOUT });
  });

  await mesurer(page, cdp, 'onglet Carcasses', async () => {
    await page.getByRole('link', { name: 'Carcasses', exact: true }).first().click();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: STEP_TIMEOUT });
  });

  await mesurer(page, cdp, 'retour à l’onglet Fiches', async () => {
    await page.getByRole('link', { name: 'Fiches', exact: true }).first().click();
    await expect(totalBadge).toBeVisible({ timeout: STEP_TIMEOUT });
  });

  const stockage = await page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);
  console.log(`IndexedDB + caches : ${Math.round(stockage / 1024 / 1024)} Mo`);
  console.table(mesures);
});
