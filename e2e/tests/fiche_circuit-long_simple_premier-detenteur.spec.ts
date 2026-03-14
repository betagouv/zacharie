import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Pas de stockage - Je transporte les carcasses moi-même", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible();
  await expect(page.getByRole("link", { name: feiId })).toContainText("À compléter");
  await expect(page.getByRole("link", { name: feiId })).toContainText("chassenard");
  await expect(page.getByRole("link", { name: feiId })).toContainText("10 pigeons");
  await expect(page.getByRole("link", { name: feiId })).toContainText("3 daims");
  await expect(page.getByRole("link", { name: feiId })).toContainText("À renseigner");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("heading", { name: "🫵 Cette fiche vous a été" }).click();
  await expect(page.getByRole("button", { name: "Je prends en charge cette" })).toBeVisible();
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
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await expect(page.getByText("Unique - Abcès ou nodules")).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button").click();
  await page.getByRole("button", { name: "Pigeons (10) N° MM-001-003" }).click();
  await page.getByLabel("Pigeons - N° MM-001-").getByTitle("Fermer").click();
  await page.getByRole("button", { name: "Je prends en charge cette" }).click();
  await expect(page.getByRole("heading", { name: "Validation par le premier dé" })).toBeVisible();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  await expect(page.getByRole("heading", { name: "Attention" })).toBeVisible();
  await expect(page.getByText("Il manque le lieu de stockage")).toBeVisible();
  const pasDeStockage1 = page.getByText("Pas de stockage").first();
  await pasDeStockage1.scrollIntoViewIfNeeded();
  await pasDeStockage1.click();
  await expect(page.getByText("Il manque le type de transport")).toBeVisible();
  const jaiDepose = page.getByText("J'ai déposé mes carcasses").first();
  await jaiDepose.scrollIntoViewIfNeeded();
  await jaiDepose.click();
  await expect(page.getByText("Il manque le centre de")).toBeVisible();
  const pasDeStockage2 = page.getByText("Pas de stockage").first();
  await pasDeStockage2.scrollIntoViewIfNeeded();
  await pasDeStockage2.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  const leTransport = page.getByText("Le transport est réalisé par").first();
  await leTransport.scrollIntoViewIfNeeded();
  await leTransport.click();
  const jeTransporte2 = page.getByText("Je transporte les carcasses").first();
  await jeTransporte2.scrollIntoViewIfNeeded();
  await jeTransporte2.click();
  const transmettreBtn = page.getByRole("button", { name: "Transmettre la fiche" });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Attribution effectu/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible();
});

test("Stockage - Je transporte les carcasses moi-même", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Je prends en charge cette" }).click();
  await expect(page.getByText("Étape suivante : Transport")).toBeVisible({ timeout: 10000 });
  const selectContainer = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectContainer.scrollIntoViewIfNeeded();
  await selectContainer.click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const jaiDepose = page.getByText("J'ai déposé mes carcasses").first();
  await jaiDepose.scrollIntoViewIfNeeded();
  await jaiDepose.click();
  await page.getByRole("button", { name: "Renseigner ma chambre froide" }).click();
  await page.getByText("Oui, ma chambre froide a un numéro d'identification").click();
  await page.getByRole("textbox", { name: "Numéro d'identification" }).fill("CCG-01");
  await page.getByRole("button", { name: "Ajouter cette chambre froide" }).click();
  // Modal closes and CCG is auto-selected
  await expect(page.getByText("CCG Chasseurs - CCG-01")).toBeVisible();
  const cliquezIci = page.getByRole("button", { name: /Cliquez ici pour définir la/ }).first();
  await cliquezIci.scrollIntoViewIfNeeded();
  await cliquezIci.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  const cliquezIci2 = page.getByRole("button", { name: /Cliquez ici pour définir la date du jour/ }).last();
  await cliquezIci2.scrollIntoViewIfNeeded();
  await cliquezIci2.click();
  const transmettreBtn = page.getByRole("button", { name: "Transmettre la fiche" });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 10000 });
});

test("Stockage - Le transport est réalisé par un collecteur professionnel", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Je prends en charge cette" }).click();
  await expect(page.getByText("Étape suivante : Transport")).toBeVisible({ timeout: 10000 });
  const selectContainer = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectContainer.scrollIntoViewIfNeeded();
  await selectContainer.click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const jaiDepose = page.getByText("J'ai déposé mes carcasses").first();
  await jaiDepose.scrollIntoViewIfNeeded();
  await jaiDepose.click();
  await page.getByRole("button", { name: "Renseigner ma chambre froide" }).click();
  await page.getByText("Oui, ma chambre froide a un numéro d'identification").click();
  await page.getByRole("textbox", { name: "Numéro d'identification" }).fill("CCG-01");
  await page.getByRole("button", { name: "Ajouter cette chambre froide" }).click();
  // Modal closes and CCG is auto-selected
  await expect(page.getByText("CCG Chasseurs - CCG-01")).toBeVisible();
  const cliquezIci = page.getByRole("button", { name: /Cliquez ici pour définir la/ }).first();
  await cliquezIci.scrollIntoViewIfNeeded();
  await cliquezIci.click();
  const leTransport = page.getByText("Le transport est réalisé par un collecteur professionnel");
  await leTransport.scrollIntoViewIfNeeded();
  await leTransport.click();
  const transmettreBtn = page.getByRole("button", { name: "Transmettre la fiche" });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 10000 });
});
