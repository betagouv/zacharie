import { test, expect, type Page } from '../../utils/test';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 157 — Easter egg : taper « zacharie » sur une nouvelle fiche ouvre un chat. Le chasseur
// dicte sa chasse, le serveur la lit avec Albert et renvoie les données vérifiées, que le front écrit
// sur la fiche. La CI n'a pas de clé Albert : la route /assistant-fiche est simulée, on teste ici
// l'interface (ouverture, écriture locale, commune, fiche remplie à la fermeture). La lecture serveur
// est couverte par assistant-fiche-route.test.ts.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
  // sans service worker, page.route voit directement la requête à l'assistant
  serviceWorkers: 'block',
});

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

const isAssistantUrl = (url: URL) => url.pathname.startsWith('/assistant-fiche/');

// la fiche telle que le store l'a enregistrée dans IndexedDB (une clé par fiche)
async function readLocalFei(page: Page, numero: string) {
  return page.evaluate(
    (key) =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        const req = indexedDB.open('keyval-store');
        req.onsuccess = () => {
          const valueReq = req.result.transaction('keyval', 'readonly').objectStore('keyval').get(key);
          valueReq.onsuccess = () => resolve(valueReq.result ?? null);
          valueReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      }),
    `zs:feis/${numero}`
  );
}

async function openNewFicheAndChat(page: Page) {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page).toHaveURL(/\/app\/chasseur\/fei\/ZACH-/);
  const numero = new URL(page.url()).pathname.split('/').pop()!;
  await expect.poll(() => readLocalFei(page, numero), { timeout: 10000 }).not.toBeNull();

  // les touches doivent arriver à la page, pas à un champ
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.type('zacharie');
  await expect(page.getByRole('dialog', { name: 'Zacharie' })).toBeVisible({ timeout: 10000 });
  return numero;
}

test('taper zacharie ouvre le chat, la réponse remplit la fiche et la commune est choisie', async ({
  page,
}) => {
  const today = dayjs.utc().format('YYYY-MM-DD');
  let sentMessages: unknown = null;
  await page.route(isAssistantUrl, async (route) => {
    sentMessages = route.request().postDataJSON().messages;
    await route.fulfill({
      json: {
        ok: true,
        data: {
          assistant_request_id: 'request-157',
          reply: '',
          date_mise_a_mort: today,
          heure_mise_a_mort_premiere_carcasse: '07:30',
          heure_evisceration_derniere_carcasse: null,
          commune_recherchee: 'Chassenard',
          communes_trouvees: ['03510 CHASSENARD'],
          premier_detenteur: null,
          carcasses: [
            {
              numero_bracelet: 'JD-03-001',
              espece: 'Chevreuil',
              type: 'GROS_GIBIER',
              nombre_d_animaux: 1,
              commentaire: null,
            },
          ],
        },
        error: '',
      },
    });
  });

  await openNewFicheAndChat(page);
  const chat = page.getByRole('dialog', { name: 'Zacharie' });
  await chat
    .getByRole('textbox', { name: 'Votre message à Zacharie' })
    .fill("aujourd'hui à Chassenard, tué à 7h30, un chevreuil JD-03-001");
  await chat.getByRole('button', { name: 'Envoyer' }).click();

  await expect(chat.getByText('Carcasse ajoutée : JD-03-001 — Chevreuil')).toBeVisible({ timeout: 10000 });
  expect(sentMessages).toEqual([
    { role: 'user', content: "aujourd'hui à Chassenard, tué à 7h30, un chevreuil JD-03-001" },
  ]);
  await expect(chat.getByText(/Commune : .*CHASSENARD/)).toBeVisible();

  // le chat demande ce qui manque et propose les propriétaires initiaux comme le formulaire
  await expect(chat.getByText('Il me manque encore')).toBeVisible();
  await expect(chat.getByText('- le propriétaire initial')).toBeVisible();
  await chat.getByRole('button', { name: 'Pierre Petit' }).click();
  await expect(chat.getByText('Propriétaire initial : Pierre Petit')).toBeVisible();
  await expect(chat.getByRole('button', { name: 'Pierre Petit' })).toBeHidden();

  await chat.getByRole('button', { name: 'Fermer' }).click();
  await expect(chat).toBeHidden();
  await expect(page.locator('#date_mise_a_mort')).toHaveValue(today);
  await expect(page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' })).toHaveValue(
    /CHASSENARD/
  );
  // Pierre Petit (premier-detenteur@example.fr) dans le seed
  await expect(page.locator('select[name="next_owner"]')).toHaveValue('0Y545');
  // la carcasse est écrite par le front, comme au formulaire
  await expect(page.getByText('N° JD-03-001')).toBeVisible();
});

test("taper zacharie affiche l'erreur quand l'assistant est indisponible", async ({ page }) => {
  await page.route(isAssistantUrl, (route) =>
    route.fulfill({ status: 503, json: { ok: false, data: null, error: 'Assistant indisponible' } })
  );

  await openNewFicheAndChat(page);
  const chat = page.getByRole('dialog', { name: 'Zacharie' });
  await chat.getByRole('textbox', { name: 'Votre message à Zacharie' }).fill('deux sangliers');
  await chat.getByRole('button', { name: 'Envoyer' }).click();
  await expect(chat.getByText('Assistant indisponible')).toBeVisible({ timeout: 10000 });

  await chat.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('#date_mise_a_mort')).toHaveValue('');
});
