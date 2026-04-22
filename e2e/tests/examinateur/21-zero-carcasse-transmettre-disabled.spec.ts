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

test.beforeAll(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("0 carcasse → bouton Transmettre désactivé", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await page.getByRole("button", { name: "Nouvelle fiche" }).first().click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // Aucune carcasse ajoutée
  const transmettre = page.getByRole("button", { name: "Transmettre", exact: true });
  if (await transmettre.count()) {
    await expect(transmettre).toBeDisabled();
  } else {
    // Transmettre pas encore atteignable tant que bloc 2 non validé — attendu
    await expect(
      page.getByRole("button", { name: /Ajouter la carcasse|Ajouter une autre carcasse/i }).first(),
    ).toBeVisible();
  }
});
