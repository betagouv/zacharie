import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG');
});
test.use({
  launchOptions: {
    slowMo: 100,
  },
});

test("Pas de stockage - J'envoie au SVI", async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard Pierre Petit \\d+ pigeons 3 daims fin de liste ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /\\/app\\/etg\\/fei\\/ZACH-\\d+-QZ6E0-\\d+/
        - paragraph: À compléter
        - img
        - paragraph: chassenard
        - img
        - paragraph: Pierre Petit
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
      `);
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Fiche reçue, pas encore prise en charge')).toBeVisible({
    timeout: 15000,
  });

  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: "/Fiche n° : ZACH-\\\\d+-QZ6E0-\\\\d+/"
        - paragraph: "Espèces : Daim, Pigeons"
        - paragraph: "/Mise à mort : \\\\d+ CHASSENARD, lundi 7 juillet \\\\d+/"
        - paragraph: "/Horaires : \\\\d+:\\\\d+ → \\\\d+:\\\\d+/"
        - paragraph: "/Dépôt CCG : CCG Chasseurs, lundi 7 juillet \\\\d+ à \\\\d+:\\\\d+/"
        - paragraph: "Adresse CCG : 2 avenue du général de gaulle, 75000 Paris"
        - paragraph: Parcours de la fiche
        - text: Marie Martin
        - paragraph: Examinateur initial
        - link /\\d+/:
          - /url: tel:0606060601
        - link "examinateur@example.fr":
          - /url: mailto:examinateur@example.fr
        - text: /N° CFEI CFEI-\\d+-\\d+-\\d+ \\d+ Paris Pierre Petit/
        - paragraph: Premier détenteur
        - link /\\d+/:
          - /url: tel:0606060602
        - link "premier-detenteur@example.fr":
          - /url: mailto:premier-detenteur@example.fr
        - text: /\\d+ Paris/
      `);
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' }).click();
  await page.getByRole('heading', { name: 'Pigeons - N° MM-001-' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByTitle('Fermer').click();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await expect(page.getByText('Abcès unique - Externe')).toBeVisible();
  await page.getByLabel('Daim - N° MM-001-002').getByTitle('Fermer').click();
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await expect(page.getByText('Abcès - Système respiratoire (trachée, poumons)')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();
  await expect(
    page.getByText('Sélection du prochain destinataireProchain détenteur des carcassesIndiquez')
  ).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByText('Anomalies abats:Abcès - Système').click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByText('Anomalies carcasse:Abcès unique -').click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse refusée').click();
  await page.locator('.input-for-search-prefilled-data__input-container').click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByRole('textbox', { name: 'Votre commentaire Un' }).click();
  await page.getByRole('textbox', { name: 'Votre commentaire Un' }).fill('Pas bon');
  await page.getByLabel('Daim - N° MM-001-002').getByText('Un commentaire à ajouter ?').click();
  await page.getByLabel('Daim - N° MM-001-002').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse manquante').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();
  await expect(
    page.getByText('Prise en charge des carcasses acceptées ou non refusées (10 pigeons, 1 daim).')
  ).toBeVisible();
  await expect(page.getByText('Refus de 1 carcasse.')).toBeVisible();
  await expect(page.getByText('Je signale 1 carcasse manquante.')).toBeVisible();
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await expect(page.getByText('Il manque le prochain dé')).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ Acceptée par ETG 1 1 anomalie/':
        - paragraph: Daim
        - paragraph: /N° MM-\\d+-\\d+/
        - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
        - paragraph: Acceptée par ETG 1
        - paragraph: 1 anomalie
      `);
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
        - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ Refusée par ETG 1 1 anomalie, 1 commentaire/':
          - paragraph: Daim
          - paragraph: /N° MM-\\d+-\\d+/
          - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
          - paragraph: Refusée par ETG 1
          - paragraph: 1 anomalie, 1 commentaire
        `);
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ Manquante pour ETG 1/':
        - paragraph: Daim
        - paragraph: /N° MM-\\d+-\\d+/
        - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
        - paragraph: Manquante pour ETG 1
      `);
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - 'button /Pigeons \\(\\d+\\) N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+/':
        - paragraph: /Pigeons \\(\\d+\\)/
        - paragraph: /N° MM-\\d+-\\d+/
        - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
      `);
  await page.getByRole('link', { name: 'Voir toutes mes fiches' }).click();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ En cours \\d+\\/\\d+\\/\\d+ chassenard Pierre Petit \\d+ pigeons 3 daims fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /\\/app\\/etg\\/fei\\/ZACH-\\d+-QZ6E0-\\d+/
        - paragraph: En cours
        - img
        - paragraph: chassenard
        - img
        - paragraph: Pierre Petit
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
        - img
        - paragraph: 2 carcasses refusées
      `);
});

test('Pas de stockage - Je transfère à un autre collecteur', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard Pierre Petit \\d+ pigeons 3 daims fin de liste ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /\\/app\\/etg\\/fei\\/ZACH-\\d+-QZ6E0-\\d+/
        - paragraph: À compléter
        - img
        - paragraph: chassenard
        - img
        - paragraph: Pierre Petit
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
      `);
  await page.getByRole('link', { name: feiId }).click();

  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: "/Fiche n° : ZACH-\\\\d+-QZ6E0-\\\\d+/"
        - paragraph: "Espèces : Daim, Pigeons"
        - paragraph: "/Mise à mort : \\\\d+ CHASSENARD, lundi 7 juillet \\\\d+/"
        - paragraph: "/Horaires : \\\\d+:\\\\d+ → \\\\d+:\\\\d+/"
        - paragraph: "/Dépôt CCG : CCG Chasseurs, lundi 7 juillet \\\\d+ à \\\\d+:\\\\d+/"
        - paragraph: "Adresse CCG : 2 avenue du général de gaulle, 75000 Paris"
        - paragraph: Parcours de la fiche
        - text: Marie Martin
        - paragraph: Examinateur initial
        - link /\\d+/:
          - /url: tel:0606060601
        - link "examinateur@example.fr":
          - /url: mailto:examinateur@example.fr
        - text: /N° CFEI CFEI-\\d+-\\d+-\\d+ \\d+ Paris Pierre Petit/
        - paragraph: Premier détenteur
        - link /\\d+/:
          - /url: tel:0606060602
        - link "premier-detenteur@example.fr":
          - /url: mailto:premier-detenteur@example.fr
        - text: /\\d+ Paris/
      `);
  await expect(page.getByText('Fiche reçue, pas encore prise en charge')).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' }).click();
  await page.getByRole('heading', { name: 'Pigeons - N° MM-001-' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByTitle('Fermer').click();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await expect(page.getByText('Abcès unique - Externe')).toBeVisible();
  await page.getByLabel('Daim - N° MM-001-002').getByTitle('Fermer').click();
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await expect(page.getByText('Abcès - Système respiratoire (trachée, poumons)')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();
  await expect(
    page.getByText('Sélection du prochain destinataireProchain détenteur des carcassesIndiquez')
  ).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByText('Anomalies abats:Abcès - Système').click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByText('Anomalies carcasse:Abcès unique -').click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse refusée').click();
  await page.locator('.input-for-search-prefilled-data__input-container').click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByRole('textbox', { name: 'Votre commentaire Un' }).click();
  await page.getByRole('textbox', { name: 'Votre commentaire Un' }).fill('Pas bon');
  await page.getByLabel('Daim - N° MM-001-002').getByText('Un commentaire à ajouter ?').click();
  await page.getByLabel('Daim - N° MM-001-002').getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse manquante').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();
  await expect(
    page.getByText('Prise en charge des carcasses acceptées ou non refusées (10 pigeons, 1 daim).')
  ).toBeVisible();
  await expect(page.getByText('Refus de 1 carcasse.')).toBeVisible();
  await expect(page.getByText('Je signale 1 carcasse manquante.')).toBeVisible();
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await expect(page.getByText('Il manque le prochain dé')).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'Collecteur Pro 2 - 75000' }).click();
  await expect(page.getByText('Il manque le prochain dé')).toBeHidden();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
    - heading "Attribution effectuée" [level=3]
    - paragraph: Collecteur Pro 2 a été notifié.
    `);
  await page.getByRole('link', { name: 'Voir toutes mes fiches' }).click();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
    - link /ZACH-\\d+-QZ6E0-\\d+ En cours \\d+\\/\\d+\\/\\d+ chassenard Pierre Petit \\d+ pigeons 3 daims fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
      - /url: /\\/app\\/etg\\/fei\\/ZACH-\\d+-QZ6E0-\\d+/
      - paragraph: En cours
      - img
      - paragraph: chassenard
      - img
      - paragraph: Pierre Petit
      - img
      - paragraph: /\\d+ pigeons/
      - paragraph: 3 daims
      - paragraph: fin de liste
      - img
      - paragraph: 2 carcasses refusées
    `);
});

test('Pas de stockage - Je transfère à un autre ETG', async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard Pierre Petit \\d+ pigeons 3 daims fin de liste ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /\\/app\\/etg\\/fei\\/ZACH-\\d+-QZ6E0-\\d+/
        - paragraph: À compléter
        - img
        - paragraph: chassenard
        - img
        - paragraph: Pierre Petit
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
      `);
  await page.getByRole('link', { name: feiId }).click();

  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: "/Fiche n° : ZACH-\\\\d+-QZ6E0-\\\\d+/"
        - paragraph: "Espèces : Daim, Pigeons"
        - paragraph: "/Mise à mort : \\\\d+ CHASSENARD, lundi 7 juillet \\\\d+/"
        - paragraph: "/Horaires : \\\\d+:\\\\d+ → \\\\d+:\\\\d+/"
        - paragraph: "/Dépôt CCG : CCG Chasseurs, lundi 7 juillet \\\\d+ à \\\\d+:\\\\d+/"
        - paragraph: "Adresse CCG : 2 avenue du général de gaulle, 75000 Paris"
        - paragraph: Parcours de la fiche
        - text: Marie Martin
        - paragraph: Examinateur initial
        - link /\\d+/:
          - /url: tel:0606060601
        - link "examinateur@example.fr":
          - /url: mailto:examinateur@example.fr
        - text: /N° CFEI CFEI-\\d+-\\d+-\\d+ \\d+ Paris Pierre Petit/
        - paragraph: Premier détenteur
        - link /\\d+/:
          - /url: tel:0606060602
        - link "premier-detenteur@example.fr":
          - /url: mailto:premier-detenteur@example.fr
        - text: /\\d+ Paris/
      `);
  await expect(page.getByText('Fiche reçue, pas encore prise en charge')).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' }).click();
  await page.getByRole('heading', { name: 'Pigeons - N° MM-001-' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByTitle('Fermer').click();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await expect(page.getByText('Abcès unique - Externe')).toBeVisible();
  await page.getByLabel('Daim - N° MM-001-002').getByTitle('Fermer').click();
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await expect(page.getByText('Abcès - Système respiratoire (trachée, poumons)')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();
  await expect(
    page.getByText('Sélection du prochain destinataireProchain détenteur des carcassesIndiquez')
  ).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByText('Anomalies abats:Abcès - Système').click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByText('Anomalies carcasse:Abcès unique -').click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse refusée').click();
  await page.locator('.input-for-search-prefilled-data__input-container').click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByRole('textbox', { name: 'Votre commentaire Un' }).click();
  await page.getByRole('textbox', { name: 'Votre commentaire Un' }).fill('Pas bon');
  await page.getByLabel('Daim - N° MM-001-002Anomalies').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse manquante').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();
  await expect(
    page.getByText('Prise en charge des carcasses acceptées ou non refusées (10 pigeons, 1 daim).')
  ).toBeVisible();
  await expect(page.getByText('Refus de 1 carcasse.')).toBeVisible();
  await expect(page.getByText('Je signale 1 carcasse manquante.')).toBeVisible();
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await expect(page.getByText('Il manque le prochain dé')).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 2 - 75000 Paris (' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - heading "Attribution effectuée" [level=3]
      - paragraph: ETG 2 a été notifié.
      `);
  await page.getByRole('link', { name: 'Voir toutes mes fiches' }).click();
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ En cours \\d+\\/\\d+\\/\\d+ chassenard Pierre Petit \\d+ pigeons 3 daims fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /\\/app\\/etg\\/fei\\/ZACH-\\d+-QZ6E0-\\d+/
        - paragraph: En cours
        - img
        - paragraph: chassenard
        - img
        - paragraph: Pierre Petit
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
        - img
        - paragraph: 2 carcasses refusées
      `);
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await logoutAndConnect(page, 'etg-2@example.fr');
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
    - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard ETG 1 \\d+ pigeons 3 daims fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
      - /url: /\\/app\\/etg\\/fei\\/ZACH-\\d+-QZ6E0-\\d+/
      - paragraph: À compléter
      - img
      - paragraph: chassenard
      - img
      - paragraph: ETG 1
      - img
      - paragraph: /\\d+ pigeons/
      - paragraph: 3 daims
      - paragraph: fin de liste
      - img
      - paragraph: 2 carcasses refusées
    `);
  await page.getByRole('link', { name: 'ZACH-20250707-QZ6E0-165242 À' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).toBeVisible();
  await expect(page.getByRole('button', { name: "Renvoyer à l'expéditeur" })).toBeVisible();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
});
