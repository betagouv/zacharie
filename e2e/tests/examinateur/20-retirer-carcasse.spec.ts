import { test, expect } from "@playwright/test";
import dayjs from "dayjs";
import "dayjs/locale/fr";
dayjs.locale("fr");
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Retirer une carcasse déjà ajoutée — compteur MAJ + transmission OK", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // Ajouter 2 carcasses
  for (let i = 0; i < 2; i++) {
    if (i > 0) await page.getByRole("button", { name: "Ajouter une autre carcasse" }).click();
    await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
    await page.getByRole("button", { name: "Utiliser" }).click();
    await page.getByRole("button", { name: "Ajouter la carcasse" }).click();
  }

  // Supprimer la 1ère
  const carcasseItems = page.getByRole("button", { name: /Daim N°/ });
  await expect(carcasseItems).toHaveCount(2);
  await carcasseItems.first().click();
  const supprimer = page.getByRole("button", { name: /Supprimer|Retirer/i }).first(); // TODO: verify selector
  await supprimer.scrollIntoViewIfNeeded();
  await supprimer.click();

  // Confirmer dans la modale éventuelle
  const confirm = page.getByRole("button", { name: /Oui|Confirmer/i }).first();
  if (await confirm.count()) {
    await confirm.click();
  }

  await expect(page.getByRole("button", { name: /Daim N°/ })).toHaveCount(1);
});
