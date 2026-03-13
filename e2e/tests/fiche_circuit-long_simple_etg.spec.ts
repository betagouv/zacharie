import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";
import { NETWORK_PRESETS } from "../utils/network-throttling";

test.beforeEach(async () => {
  await resetDb("ETG");
});
test.use({
  launchOptions: {
    slowMo: 100,
  },
});

test("Pas de stockage - J'envoie au SVI", async ({ page, context }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "etg-1@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 3 daims fin de liste ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
        - paragraph: À compléter
        - img
        - paragraph: chassenard
        - img
        - paragraph: À renseigner
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
      `);
  await page.getByRole("link", { name: feiId }).click();
  await page.locator("summary").filter({ hasText: "Données de traçabilité" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: Espèces
        - paragraph: Daim, Pigeons
        - paragraph: Informations clés
        - list:
          - listitem:
            - paragraph: "/Commune de mise à mort : \\\\d+ CHASSENARD/"
          - listitem:
            - paragraph: "/Date de mise à mort : lundi 7 juillet \\\\d+/"
          - listitem:
            - paragraph: "/Heure de mise à mort de la première carcasse de la fiche : \\\\d+:\\\\d+/"
        - paragraph: Acteurs
        - paragraph: Examinateur Initial
        - list:
          - listitem:
            - paragraph: Marie Martin
          - listitem:
            - paragraph: /\\d+/
          - listitem:
            - paragraph: examinateur@example.fr
          - listitem:
            - paragraph: /CFEI-\\d+-\\d+-\\d+/
          - listitem:
            - paragraph: /\\d+ Paris/
        - paragraph: Premier Détenteur
        - list:
          - listitem:
            - paragraph: Pierre Petit
          - listitem:
            - paragraph: /\\d+/
          - listitem:
            - paragraph: premier-detenteur@example.fr
          - listitem:
            - paragraph: /\\d+ Paris/
      `);
  await page.getByRole("heading", { name: "🫵 Cette fiche vous a été" }).click();
  await expect(page.getByText("Étape 2 sur")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fiche envoyée, pas encore" })).toBeVisible();
  await expect(page.getByText("Étape suivante : Transport")).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" }).click();
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Pigeons (10) N° MM-001-003" }).click();
  await page.getByRole("heading", { name: "Pigeons - N° MM-001-" }).click();
  await page.getByLabel("Pigeons - N° MM-001-").getByTitle("Fermer").click();
  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await expect(page.getByText("Unique - Abcès ou nodules")).toBeVisible();
  await page.getByLabel("Daim - N° MM-001-002").getByTitle("Fermer").click();
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  await expect(page.getByText("Abcès ou nodules Unique -")).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("heading", { name: "Réception par mon établissement de traitement" })).toBeVisible();
  await expect(page.getByText("Étape suivante : Inspection")).toBeVisible();
  await expect(
    page.getByText("Sélection du prochain destinataireProchain détenteur des carcasses *Indiquez"),
  ).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500)); // if not, react-dsfr modal is having a bad time cause too many re-renders (I think)
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  await page.getByText("Anomalies abats:Abcès ou").click();
  await page.getByLabel("Daim - N° MM-001-001").getByText("Carcasse acceptée").click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" })).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await page.getByText("Anomalies carcasse:Unique -").click();
  await page.getByLabel("Daim - N° MM-001-002").getByText("Carcasse refusée").click();
  await page.locator(".input-for-search-prefilled-data__input-container").click();
  await page.getByRole("option", { name: "Présence de souillures" }).click();
  await page.getByRole("textbox", { name: "Votre commentaire Un" }).click();
  await page.getByRole("textbox", { name: "Votre commentaire Un" }).fill("Pas bon");
  await page.getByLabel("Daim - N° MM-001-002").getByText("Un commentaire à ajouter ?").click();
  await page.getByLabel("Daim - N° MM-001-002").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" })).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" }).click();
  await page.getByLabel("Daim - N° MM-001-004").getByText("Carcasse manquante").click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" })).toBeVisible();
  await expect(
    page.getByText("Prise en charge des carcasses acceptées ou non refusées (10 pigeons, 1 daim)."),
  ).toBeVisible();
  await expect(page.getByText("Refus de 1 carcasse.")).toBeVisible();
  await expect(page.getByText("Je signale 1 carcasse manquante.")).toBeVisible();
  // await new Promise((resolve) => setTimeout(resolve, 200)); // to maybe prevent cache-lookup bug from postgres in backend
  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  // await new Promise((resolve) => setTimeout(resolve, 200)); // to maybe prevent cache-lookup bug from postgres in backend
  // await page.getByRole("button", { name: "Enregistrer" }).click();
  // await new Promise((resolve) => setTimeout(resolve, 200)); // to maybe prevent cache-lookup bug from postgres in backend
  await expect(page.getByText("Il manque le prochain dé")).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "SVI 1 - 75000 Paris (Service" }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  // await new Promise((resolve) => setTimeout(resolve, 200)); // to maybe prevent cache-lookup bug from postgres in backend
  await expect(page.getByText("SVI 1 a été notifié")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ 1 anomalie accepté/':
        - paragraph: Daim
        - paragraph: /N° MM-\\d+-\\d+/
        - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
        - paragraph: 1 anomalie
        - paragraph: accepté par ETG 1 ETG
      `);
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
        - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ 1 anomalie, 1 commentaire refusé par ETG 1/':
          - paragraph: Daim
          - paragraph: /N° MM-\\d+-\\d+/
          - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
          - paragraph: 1 anomalie, 1 commentaire
          - paragraph: refusé par ETG 1
        `);
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ Aucune anomalie manquant pour ETG 1/':
        - paragraph: Daim
        - paragraph: /N° MM-\\d+-\\d+/
        - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
        - paragraph: Aucune anomalie
        - paragraph: manquant pour ETG 1
      `);
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - 'button /Pigeons \\(\\d+\\) N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ Aucune anomalie en cours de traitement/':
        - paragraph: /Pigeons \\(\\d+\\)/
        - paragraph: /N° MM-\\d+-\\d+/
        - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
        - paragraph: Aucune anomalie
        - paragraph: en cours de traitement
      `);
  await page.getByRole("link", { name: "Voir toutes mes fiches" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ En cours \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 1 daim fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
        - paragraph: En cours
        - img
        - paragraph: chassenard
        - img
        - paragraph: À renseigner
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 1 daim
        - paragraph: fin de liste
        - img
        - paragraph: 2 carcasses refusées
      `);
});

test("Pas de stockage - Je transfère à un autre collecteur", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "etg-1@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 3 daims fin de liste ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
        - paragraph: À compléter
        - img
        - paragraph: chassenard
        - img
        - paragraph: À renseigner
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
      `);
  await page.getByRole("link", { name: feiId }).click();
  await page.locator("summary").filter({ hasText: "Données de traçabilité" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: Espèces
        - paragraph: Daim, Pigeons
        - paragraph: Informations clés
        - list:
          - listitem:
            - paragraph: "/Commune de mise à mort : \\\\d+ CHASSENARD/"
          - listitem:
            - paragraph: "/Date de mise à mort : lundi 7 juillet \\\\d+/"
          - listitem:
            - paragraph: "/Heure de mise à mort de la première carcasse de la fiche : \\\\d+:\\\\d+/"
        - paragraph: Acteurs
        - paragraph: Examinateur Initial
        - list:
          - listitem:
            - paragraph: Marie Martin
          - listitem:
            - paragraph: /\\d+/
          - listitem:
            - paragraph: examinateur@example.fr
          - listitem:
            - paragraph: /CFEI-\\d+-\\d+-\\d+/
          - listitem:
            - paragraph: /\\d+ Paris/
        - paragraph: Premier Détenteur
        - list:
          - listitem:
            - paragraph: Pierre Petit
          - listitem:
            - paragraph: /\\d+/
          - listitem:
            - paragraph: premier-detenteur@example.fr
          - listitem:
            - paragraph: /\\d+ Paris/
      `);
  await page.getByRole("heading", { name: "🫵 Cette fiche vous a été" }).click();
  await expect(page.getByText("Étape 2 sur")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fiche envoyée, pas encore" })).toBeVisible();
  await expect(page.getByText("Étape suivante : Transport")).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" }).click();
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Pigeons (10) N° MM-001-003" }).click();
  await page.getByRole("heading", { name: "Pigeons - N° MM-001-" }).click();
  await page.getByLabel("Pigeons - N° MM-001-").getByTitle("Fermer").click();
  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await expect(page.getByText("Unique - Abcès ou nodules")).toBeVisible();
  await page.getByLabel("Daim - N° MM-001-002").getByTitle("Fermer").click();
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  await expect(page.getByText("Abcès ou nodules Unique -")).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("heading", { name: "Réception par mon établissement de traitement" })).toBeVisible();
  await expect(page.getByText("Étape suivante : Inspection")).toBeVisible();
  await expect(
    page.getByText("Sélection du prochain destinataireProchain détenteur des carcasses *Indiquez"),
  ).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500)); // if not, react-dsfr modal is having a bad time cause too many re-renders (I think)
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  await page.getByText("Anomalies abats:Abcès ou").click();
  await page.getByLabel("Daim - N° MM-001-001").getByText("Carcasse acceptée").click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" })).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await page.getByText("Anomalies carcasse:Unique -").click();
  await page.getByLabel("Daim - N° MM-001-002").getByText("Carcasse refusée").click();
  await page.locator(".input-for-search-prefilled-data__input-container").click();
  await page.getByRole("option", { name: "Présence de souillures" }).click();
  await page.getByRole("textbox", { name: "Votre commentaire Un" }).click();
  await page.getByRole("textbox", { name: "Votre commentaire Un" }).fill("Pas bon");
  await page.getByLabel("Daim - N° MM-001-002").getByText("Un commentaire à ajouter ?").click();
  await page.getByLabel("Daim - N° MM-001-002").getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" })).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" }).click();
  await page.getByLabel("Daim - N° MM-001-004").getByText("Carcasse manquante").click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" })).toBeVisible();
  await expect(
    page.getByText("Prise en charge des carcasses acceptées ou non refusées (10 pigeons, 1 daim)."),
  ).toBeVisible();
  await expect(page.getByText("Refus de 1 carcasse.")).toBeVisible();
  await expect(page.getByText("Je signale 1 carcasse manquante.")).toBeVisible();
  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  // await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Il manque le prochain dé")).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "Collecteur Pro 2 - 75000" }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - heading "Attribution effectuée" [level=3]
    - paragraph: Collecteur Pro 2 a été notifié.
    `);
  await page.getByRole("link", { name: "Voir toutes mes fiches" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - link /ZACH-\\d+-QZ6E0-\\d+ En cours \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 1 daim fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
      - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
      - paragraph: En cours
      - img
      - paragraph: chassenard
      - img
      - paragraph: À renseigner
      - img
      - paragraph: /\\d+ pigeons/
      - paragraph: 1 daim
      - paragraph: fin de liste
      - img
      - paragraph: 2 carcasses refusées
    `);
});

test("Pas de stockage - Je transfère à un autre ETG", async ({ page, context }) => {
  // const cdpSession = await context.newCDPSession(page);
  // // @ts-ignore
  // await cdpSession.send("Network.emulateNetworkConditions", NETWORK_PRESETS.PrettyGood);

  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "etg-1@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 3 daims fin de liste ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
        - paragraph: À compléter
        - img
        - paragraph: chassenard
        - img
        - paragraph: À renseigner
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 3 daims
        - paragraph: fin de liste
      `);
  await page.getByRole("link", { name: feiId }).click();
  await page.locator("summary").filter({ hasText: "Données de traçabilité" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: Espèces
        - paragraph: Daim, Pigeons
        - paragraph: Informations clés
        - list:
          - listitem:
            - paragraph: "/Commune de mise à mort : \\\\d+ CHASSENARD/"
          - listitem:
            - paragraph: "/Date de mise à mort : lundi 7 juillet \\\\d+/"
          - listitem:
            - paragraph: "/Heure de mise à mort de la première carcasse de la fiche : \\\\d+:\\\\d+/"
        - paragraph: Acteurs
        - paragraph: Examinateur Initial
        - list:
          - listitem:
            - paragraph: Marie Martin
          - listitem:
            - paragraph: /\\d+/
          - listitem:
            - paragraph: examinateur@example.fr
          - listitem:
            - paragraph: /CFEI-\\d+-\\d+-\\d+/
          - listitem:
            - paragraph: /\\d+ Paris/
        - paragraph: Premier Détenteur
        - list:
          - listitem:
            - paragraph: Pierre Petit
          - listitem:
            - paragraph: /\\d+/
          - listitem:
            - paragraph: premier-detenteur@example.fr
          - listitem:
            - paragraph: /\\d+ Paris/
      `);
  await page.getByRole("heading", { name: "🫵 Cette fiche vous a été" }).click();
  await expect(page.getByText("Étape 2 sur")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fiche envoyée, pas encore" })).toBeVisible();
  await expect(page.getByText("Étape suivante : Transport")).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" }).click();
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Pigeons (10) N° MM-001-003" }).click();
  await page.getByRole("heading", { name: "Pigeons - N° MM-001-" }).click();
  await page.getByLabel("Pigeons - N° MM-001-").getByTitle("Fermer").click();
  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await expect(page.getByText("Unique - Abcès ou nodules")).toBeVisible();
  await page.getByLabel("Daim - N° MM-001-002").getByTitle("Fermer").click();
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  await expect(page.getByText("Abcès ou nodules Unique -")).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("heading", { name: "Réception par mon établissement de traitement" })).toBeVisible();
  await expect(page.getByText("Étape suivante : Inspection")).toBeVisible();
  await expect(
    page.getByText("Sélection du prochain destinataireProchain détenteur des carcasses *Indiquez"),
  ).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500)); // if not, react-dsfr modal is having a bad time cause too many re-renders (I think)
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  await page.getByText("Anomalies abats:Abcès ou").click();
  await page.getByLabel("Daim - N° MM-001-001").getByText("Carcasse acceptée").click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" })).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await page.getByText("Anomalies carcasse:Unique -").click();
  await page.getByLabel("Daim - N° MM-001-002").getByText("Carcasse refusée").click();
  await page.locator(".input-for-search-prefilled-data__input-container").click();
  await page.getByRole("option", { name: "Présence de souillures" }).click();
  await page.getByRole("textbox", { name: "Votre commentaire Un" }).click();
  await page.getByRole("textbox", { name: "Votre commentaire Un" }).fill("Pas bon");
  await page.getByLabel("Daim - N° MM-001-002Anomalies").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" })).toBeVisible();
  await page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" }).click();
  await page.getByLabel("Daim - N° MM-001-004").getByText("Carcasse manquante").click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" })).toBeVisible();
  await expect(
    page.getByText("Prise en charge des carcasses acceptées ou non refusées (10 pigeons, 1 daim)."),
  ).toBeVisible();
  await expect(page.getByText("Refus de 1 carcasse.")).toBeVisible();
  await expect(page.getByText("Je signale 1 carcasse manquante.")).toBeVisible();
  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  // await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Il manque le prochain dé")).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - heading "Attribution effectuée" [level=3]
      - paragraph: ETG 2 a été notifié.
      `);
  await page.getByRole("link", { name: "Voir toutes mes fiches" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - link /ZACH-\\d+-QZ6E0-\\d+ En cours \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 1 daim fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
        - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
        - paragraph: En cours
        - img
        - paragraph: chassenard
        - img
        - paragraph: À renseigner
        - img
        - paragraph: /\\d+ pigeons/
        - paragraph: 1 daim
        - paragraph: fin de liste
        - img
        - paragraph: 2 carcasses refusées
      `);
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL("http://localhost:3290/app/connexion");
  await connectWith(page, "etg-2@example.fr");
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - link /ZACH-\\d+-QZ6E0-\\d+ À compléter \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 1 daim fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
      - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
      - paragraph: À compléter
      - img
      - paragraph: chassenard
      - img
      - paragraph: À renseigner
      - img
      - paragraph: /\\d+ pigeons/
      - paragraph: 1 daim
      - paragraph: fin de liste
      - img
      - paragraph: 2 carcasses refusées
    `);
  await page.getByRole("link", { name: "ZACH-20250707-QZ6E0-165242 À" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - heading "🫵 Cette fiche a été attribuée à votre société" [level=3]
      - paragraph:
        - button "Prendre en charge les carcasses"
        - button "Je renvoie la fiche à l'expéditeur"
      `);
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  // FIXME: work in local not in ci
  // await expect(page.locator("#content")).toMatchAriaSnapshot(`
  //   - heading "Réception par mon établissement de traitement Étape 4 sur 5" [level=2]
  //   - paragraph: "Étape suivante : Inspection par le SVI"
  //   - navigation "vous êtes ici :":
  //     - list:
  //       - listitem
  //       - listitem:
  //         - button "ETG 1"
  //       - listitem:
  //         - button "ETG 2"
  //   - group:
  //     - heading "Données de traçabilité" [level=3]
  //     - paragraph: Espèces
  //     - paragraph: Pigeons, Daim
  //     - paragraph: Informations clés
  //     - list:
  //       - listitem:
  //         - paragraph: "/Commune de mise à mort : \\\\d+ CHASSENARD/"
  //       - listitem:
  //         - paragraph: "/Date de mise à mort : lundi 7 juillet \\\\d+/"
  //       - listitem:
  //         - paragraph: "/Heure de mise à mort de la première carcasse de la fiche : \\\\d+:\\\\d+/"
  //       - listitem:
  //         - paragraph: "/Heure d'éviscération de la dernière carcasse de la fiche : \\\\d+:\\\\d+/"
  //       - listitem:
  //         - paragraph: "Nom du Centre de Collecte (CCG) : CCG Chasseurs"
  //       - listitem:
  //         - paragraph: "/Date et heure de dépôt dans le CCG : lundi 7 juillet \\\\d+ à \\\\d+:\\\\d+/"
  //       - listitem:
  //         - paragraph: "/Date et heure de prise en charge par l'ETG : vendredi \\\\d+ novembre \\\\d+ à \\\\d+:\\\\d+/"
  //     - paragraph: Acteurs
  //     - paragraph: Examinateur Initial
  //     - list:
  //       - listitem:
  //         - paragraph: Marie Martin
  //       - listitem:
  //         - paragraph: /\\d+/
  //       - listitem:
  //         - paragraph: examinateur@example.fr
  //       - listitem:
  //         - paragraph: /CFEI-\\d+-\\d+-\\d+/
  //       - listitem:
  //         - paragraph: /\\d+ Paris/
  //     - paragraph: Premier Détenteur
  //     - list:
  //       - listitem:
  //         - paragraph: Pierre Petit
  //       - listitem:
  //         - paragraph: /\\d+/
  //       - listitem:
  //         - paragraph: premier-detenteur@example.fr
  //       - listitem:
  //         - paragraph: /\\d+ Paris/
  //     - paragraph: ETG 1
  //     - list:
  //       - listitem:
  //         - paragraph: Réception des carcasses
  //       - listitem:
  //         - paragraph: /\\d+/
  //       - listitem:
  //         - paragraph: /\\d+ Paris/
  //       - listitem:
  //         - paragraph: "/Prise en charge : vendredi \\\\d+ novembre à \\\\d+:\\\\d+/"
  //     - paragraph: ETG 2
  //     - list:
  //       - listitem:
  //         - paragraph: Réception des carcasses
  //       - listitem:
  //         - paragraph: /\\d+/
  //       - listitem:
  //         - paragraph: /\\d+ Paris/
  //       - listitem:
  //         - paragraph: "/Prise en charge : vendredi \\\\d+ novembre à \\\\d+:\\\\d+/"
  //   - group:
  //     - heading "Carcasses (2)" [level=3]
  //     - paragraph: Veuillez cliquer sur une carcasse pour la refuser, la signaler, l'annoter
  //     - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ 1 anomalie en cours de traitement/':
  //       - paragraph: Daim
  //       - paragraph: /N° MM-\\d+-\\d+/
  //       - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
  //       - paragraph: 1 anomalie
  //       - paragraph: en cours de traitement
  //     - 'button /Pigeons \\(\\d+\\) N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ Aucune anomalie en cours de traitement/':
  //       - paragraph: /Pigeons \\(\\d+\\)/
  //       - paragraph: /N° MM-\\d+-\\d+/
  //       - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
  //       - paragraph: Aucune anomalie
  //       - paragraph: en cours de traitement
  //     - button "Afficher les carcasses déjà refusées (2)"
  //   - group:
  //     - heading "Prise en charge des carcasses acceptées" [level=3]
  //     - paragraph /Prise en charge des carcasses acceptées ou non refusées \\(\\d+ pigeons, 1 daim\\)\\./ [checked] [disabled]
  //     - text: /Prise en charge des carcasses acceptées ou non refusées \\(\\d+ pigeons, 1 daim\\)\\. Date de prise en charge/
  //     - button "Cliquez ici pour définir cette date comme étant aujourd'hui et maintenant"
  //     - textbox "Date de prise en charge Cliquez ici pour définir cette date comme étant aujourd'hui et maintenant"
  //     - button "Enregistrer" [disabled]
  //   - group:
  //     - heading "Sélection du prochain destinataire" [level=3]
  //     - text: Prochain détenteur des carcasses * Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge le gibier.
  //     - button "SVI 2"
  //     - log
  //     - text: Sélectionnez le prochain détenteur des carcasses
  //     - combobox "Prochain détenteur des carcasses * Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge le gibier. SVI 2"
  //     - button "Transmettre la fiche"
  //     - heading "Attention" [level=3]
  //     - paragraph: Il manque le prochain détenteur des carcasses
  //   - link "Voir toutes mes fiches":
  //     - /url: /app/tableau-de-bord/
  //   `);

  await page.getByRole("button", { name: "Afficher les carcasses déjà" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ 1 anomalie, 1 commentaire refusé par ETG 1/':
        - paragraph: Daim
        - paragraph: /N° MM-\\d+-\\d+/
        - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
        - paragraph: 1 anomalie, 1 commentaire
        - paragraph: refusé par ETG 1
      `);
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - 'button /Daim N° MM-\\d+-\\d+ Mise à mort : \\d+\\/\\d+\\/\\d+ Aucune anomalie manquant pour ETG 1/':
      - paragraph: Daim
      - paragraph: /N° MM-\\d+-\\d+/
      - paragraph: "/Mise à mort : \\\\d+\\\\/\\\\d+\\\\/\\\\d+/"
      - paragraph: Aucune anomalie
      - paragraph: manquant pour ETG 1
    `);
  await expect(
    page.locator("p").filter({
      hasText: "Prise en charge des carcasses acceptées ou non refusées (10 pigeons, 1 daim).",
    }),
  ).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "SVI 2 - 75000 Paris (Service" }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - heading "Attribution effectuée" [level=3]
    - paragraph: SVI 2 a été notifié.
    `);

  await page.getByRole("link", { name: "Voir toutes mes fiches" }).click();
  await expect(page.locator("#content")).toMatchAriaSnapshot(`
    - link /ZACH-\\d+-QZ6E0-\\d+ En cours \\d+\\/\\d+\\/\\d+ chassenard À renseigner \\d+ pigeons 1 daim fin de liste 2 carcasses refusées ZACH-\\d+-QZ6E0-\\d+/:
      - /url: /app/tableau-de-bord/fei/ZACH-20250707-QZ6E0-165242
      - paragraph: En cours
      - img
      - paragraph: chassenard
      - img
      - paragraph: À renseigner
      - img
      - paragraph: /\\d+ pigeons/
      - paragraph: 1 daim
      - paragraph: fin de liste
      - img
      - paragraph: 2 carcasses refusées
    `);
});
