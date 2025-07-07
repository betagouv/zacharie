import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

let feiId: string;

test.describe.configure({ mode: "serial" }); // TODO: remove this and make the tests parallel

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.describe("Fiches examinateur initial", () => {
  test.beforeAll(async () => {
    await resetDb(false);
  });

  test("Création d'une fiche", async ({ page }) => {
    await connectWith(page, "examinateur@example.fr");
    await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
    await page.getByRole("button", { name: "Nouvelle fiche" }).nth(1).click();
    await expect(page.getByRole("heading", { name: "Examen initial Étape 1 sur" })).toBeVisible();
    await expect(page.getByText("Étape suivante : Validation")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Action de l'Examinateur" })).toBeVisible();
    await expect(page.locator("summary")).toBeVisible();
    await expect(page.getByText("* Les champs marqués d'une étoile sont obligatoires")).toBeVisible();
    await page.getByText("Date de mise à mort (et d'éviscération) *").click();
    await page.getByRole("button", { name: "Cliquez ici pour définir la date du jour", exact: true }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
    await page.getByRole("button", { name: "CHASSENARD" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).fill("12:12");
    await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).blur();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByLabel("Nouvelle carcasse / lot de").selectOption("Daim");
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByRole("textbox", { name: "Heure d'éviscération de la" }).fill("12:14");
    await page.getByRole("textbox", { name: "Heure d'éviscération de la" }).blur();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByRole("button", { name: "Cliquez ici pour définir la date du jour et maintenant" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByText("Je, Martin Marie, certifie qu").click();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page
      .getByLabel("Quel Premier Détenteur doit désormais agir sur la fiche ?")
      .selectOption("Pierre Petit - 75000 Paris");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByRole("heading", { name: "Attribution effectuée" })).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    // get fei id
    const feiId = page.url().split("/").pop()!;
    console.log(feiId);
    await page.getByRole("link", { name: "Voir toutes mes fiches" }).click();
    await expect(page.getByRole("link", { name: feiId })).toBeVisible();
    await expect(page.getByRole("link", { name: feiId })).toContainText("À compléter");
    await expect(page.getByRole("link", { name: feiId })).toContainText("chassenard");
    await expect(page.getByRole("link", { name: feiId })).toContainText("4 daims");
    await expect(page.getByRole("link", { name: feiId })).toContainText("À renseigner");
    // await page.getByRole("button", { name: "Menu" }).click();
    // await page.getByRole("button", { name: "Mon profil" }).click();
    // await page.getByRole("button", { name: "Déconnecter examinateur@example.fr" }).click();
  });
});

test.describe("Fiches premier détenteur", () => {
  test.beforeEach(async () => {
    await resetDb(true);
  });

  test("Pas de stockage - Je transporte les carcasses moi-même", async ({ page }) => {
    const feiId = "ZACH-20250707-QZ6E0-155242";
    await connectWith(page, "premier-detenteur@example.fr");
    await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
    await expect(page.getByRole("link", { name: feiId })).toBeVisible();
    await expect(page.getByRole("link", { name: feiId })).toContainText("À compléter");
    await expect(page.getByRole("link", { name: feiId })).toContainText("chassenard");
    await expect(page.getByRole("link", { name: feiId })).toContainText("4 daims");
    await expect(page.getByRole("link", { name: feiId })).toContainText("À renseigner");
    await page.getByRole("link", { name: feiId }).click();
    await page.getByRole("heading", { name: "🫵 Cette fiche vous a été" }).click();
    await expect(page.getByText("En tant que Premier Détenteur")).toBeVisible();
    await expect(page.getByRole("button", { name: "Je prends en charge cette" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Examen initial Étape 1 sur" })).toBeVisible();
    await expect(page.getByText("Étape suivante : Validation")).toBeVisible();
    await expect(page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pigeons (10) N° MM-001-003" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Daim N° MM-001-004 Mise à" })).toBeVisible();
    await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
    await expect(page.getByLabel("Daim - N° MM-001-001").getByText("Anomalies abats")).toBeVisible();
    await expect(page.getByText("Abcès ou nodules Unique -")).toBeVisible();
    await expect(page.getByLabel("Daim - N° MM-001-001").getByText("Commune de mise à mort :")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Date de mise à mort : lundi 7" })).toBeVisible();
    await expect(page.getByLabel("Daim - N° MM-001-001").getByText("Heure de mise à mort de la")).toBeVisible();
    await expect(page.getByLabel("Daim - N° MM-001-001").getByText("Anomalies carcasse")).toBeVisible();
    await expect(page.getByLabel("Daim - N° MM-001-001").getByText("N/A").first()).toBeVisible();
    await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
    await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
    await expect(page.getByText("Unique - Abcès ou nodules")).toBeVisible();
    await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
    await page.getByRole("button", { name: "Pigeons (10) N° MM-001-003" }).click();
    await page.getByLabel("Pigeons (10) - N° MM-001-").getByTitle("Fermer").click();
    await page.getByRole("button", { name: "Je prends en charge cette" }).click();
    await expect(page.getByRole("heading", { name: "Validation par le premier dé" })).toBeVisible();
    await expect(page.getByText("Étape suivante : Transport")).toBeVisible();
    await page.locator(".select-prochain-detenteur__input-container").click();
    await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
    await expect(page.getByRole("heading", { name: "Attention" })).toBeVisible();
    await expect(page.getByText("Il manque le lieu de stockage")).toBeVisible();
    await page.getByText("Pas de stockageSans stockage").click();
    await expect(page.getByText("Il manque le type de transport")).toBeVisible();
    await page.getByText("J'ai déposé mes carcasses").click();
    await expect(page.getByText("Il manque le centre de")).toBeVisible();
    await page.getByText("Pas de stockageSans stockage").click();
    await page.getByText("Je transporte les carcasses moi-mêmeN'oubliez pas de notifier le prochain dé").click();
    await page.getByText("Le transport est réalisé par").click();
    await page.getByText("Je transporte les carcasses").click();
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByRole("heading", { name: "Attribution effectuée" })).toBeVisible();
    await expect(page.getByText("ETG 1 a été notifié")).toBeVisible();
  });

  test("Stockage - Je transporte les carcasses moi-même", async ({ page }) => {
    const feiId = "ZACH-20250707-QZ6E0-155242";
    await connectWith(page, "premier-detenteur@example.fr");
    await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
    await page.getByRole("link", { name: feiId }).click();
    await page.getByRole("button", { name: "Je prends en charge cette" }).click();
    await expect(page.getByText("Il manque le prochain dé")).toBeVisible();
    await page.locator(".select-prochain-detenteur__input-container").click();
    await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
    await page.getByText("J'ai déposé mes carcasses").click();
    await page.locator(".select-ccg__input-container").click();
    await page.getByText("Aucun résultat").click();
    await page.getByRole("link", { name: "Vous n'avez pas encore" }).click();
    await page.getByRole("textbox", { name: "Si vous utilisez un CCG" }).fill("CCG-01");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await page.getByRole("link", { name: "Continuer" }).click();
    await page.locator(".select-prochain-detenteur__input-container").click();
    await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
    await page.getByText("J'ai déposé mes carcasses").click();
    await page.getByRole("button", { name: "CCG Chasseurs" }).click();
    await page.getByRole("button", { name: "Cliquez ici pour définir la" }).click();
    await page.getByText("Je transporte les carcasses moi-mêmeN'oubliez pas de notifier le prochain dé").click();
    await expect(page.getByText("Il manque la date de transport")).toBeVisible();
    await page.getByRole("button", { name: "Cliquez ici pour définir la date du jour et maintenant." }).click();
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("ETG 1 a été notifié")).toBeVisible();
  });

  test("Stockage - Le transport est réalisé par un collecteur professionnel", async ({ page }) => {
    const feiId = "ZACH-20250707-QZ6E0-155242";
    await connectWith(page, "premier-detenteur@example.fr");
    await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
    await page.getByRole("link", { name: feiId }).click();
    await page.getByRole("button", { name: "Je prends en charge cette" }).click();
    await expect(page.getByText("Il manque le prochain dé")).toBeVisible();
    await page.locator(".select-prochain-detenteur__input-container").click();
    await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
    await page.getByText("J'ai déposé mes carcasses").click();
    await page.locator(".select-ccg__input-container").click();
    await page.getByText("Aucun résultat").click();
    await page.getByRole("link", { name: "Vous n'avez pas encore" }).click();
    await page.getByRole("textbox", { name: "Si vous utilisez un CCG" }).fill("CCG-01");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await page.getByRole("link", { name: "Continuer" }).click();
    await page.locator(".select-prochain-detenteur__input-container").click();
    await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
    await page.getByText("J'ai déposé mes carcasses").click();
    await page.getByRole("button", { name: "CCG Chasseurs" }).click();
    await page.getByRole("button", { name: "Cliquez ici pour définir la" }).click();
    await page.getByText("Le transport est réalisé par un collecteur professionnel").click();
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("ETG 1 a été notifié")).toBeVisible();
  });
});

// test("Connexion avec compte collecteur pro", async ({ page }) => {
//   await connectWith(page, "collecteur-pro@example.fr");
//   await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
//   await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
//   await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).not.toBeVisible();
//   await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).not.toBeVisible();
//   await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
//   await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).not.toBeVisible();
// });

// test("Connexion avec compte établissement de traitement", async ({ page }) => {
//   await connectWith(page, "etg@example.fr");
//   await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
//   await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
//   await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).not.toBeVisible();
//   await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).not.toBeVisible();
//   await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
//   await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).not.toBeVisible();
// });

// test("Connexion avec compte svi", async ({ page }) => {
//   await connectWith(page, "svi@example.fr");
//   await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
//   await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
//   await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).not.toBeVisible();
//   await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).not.toBeVisible();
//   await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
//   await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).not.toBeVisible();
// });
