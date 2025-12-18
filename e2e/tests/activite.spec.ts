import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

test.beforeAll(async () => {
  await resetDb();
});

const chasseur = "Chasseur et/ou Examinateur Initial";
const collecteurProfessionnel = "Collecteur Professionnel Indépendant";
const etablissementDeTraitement = "Établissement de Traitement du Gibier sauvage (ETG)";
const serviceVeterinaire = "Service Vétérinaire d'Inspection (SVI)";

test("Examinateur initial", async ({ page }) => {
  page.on("console", (message) => {
    console.log(`[${message.type()}] ${message.text()}`);
  });

  await connectWith(page, "examinateur@example.fr");
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mon activité" }).click();

  await expect(page.getByText(chasseur)).toBeChecked();
  await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
  await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
  await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();
});

test("Premier détenteur", async ({ page }) => {
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mon activité" }).click();

  await expect(page.getByText(chasseur)).toBeChecked();
  await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
  await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
  await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();
});

test("Collecteur professionnel", async ({ page }) => {
  await connectWith(page, "collecteur-pro@example.fr");
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mon activité" }).click();

  await expect(page.getByText(chasseur)).not.toBeChecked();
  await expect(page.getByText(collecteurProfessionnel)).toBeChecked();
  await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
  await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();
});

test("Établissement de traitement", async ({ page }) => {
  await connectWith(page, "etg-1@example.fr");
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mon activité" }).click();

  await expect(page.getByText(chasseur)).not.toBeChecked();
  await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
  await expect(page.getByText(etablissementDeTraitement)).toBeChecked();
  await expect(page.getByText(serviceVeterinaire)).not.toBeChecked();
});

test("Service vétérinaire", async ({ page }) => {
  await connectWith(page, "svi@example.fr");
  await page.getByRole("button", { name: "Mon profil" }).click();
  await page.getByRole("link", { name: "Mon activité" }).click();

  await expect(page.getByText(chasseur)).not.toBeChecked();
  await expect(page.getByText(collecteurProfessionnel)).not.toBeChecked();
  await expect(page.getByText(etablissementDeTraitement)).not.toBeChecked();
  await expect(page.getByText(serviceVeterinaire)).toBeChecked();
});
