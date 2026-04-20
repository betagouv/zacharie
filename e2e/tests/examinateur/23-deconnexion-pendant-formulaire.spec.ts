import { test, expect } from "@playwright/test";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.locale("fr");
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Déconnexion en plein formulaire — store local nettoyé → reconnexion formulaire vide", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter la carcasse" }).click();

  // Déconnexion
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Déconnexion" }).click();

  await page.goto("http://localhost:3290/app/connexion", { timeout: 10000 });
  await connectWith(page, "examinateur@example.fr");

  // Aucune fiche existante — store nettoyé
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");
  await expect(page.getByRole("link", { name: /ZACH-/ })).toHaveCount(0);
});
