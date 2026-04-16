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

test("Heure d'éviscération < heure de mise à mort → erreur ou auto-correction", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter la carcasse" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Heure mise à mort = 10:00, éviscération = 08:00 (invalide)
  const miseAMort = page.getByRole("textbox", { name: "Heure de mise à mort de la" });
  await miseAMort.fill("10:00");
  await miseAMort.blur();

  const evisc = page.getByRole("textbox", { name: "Heure d'éviscération de la" });
  await evisc.fill("08:00");
  await evisc.blur();

  // Soit message d'erreur, soit auto-correction (la valeur redevient >= mise à mort)
  // TODO: verify expected behavior
  const errorVisible = await page.getByText(/éviscération.*avant|invalide|doit être après/i).first().isVisible().catch(() => false);
  if (!errorVisible) {
    // Auto-correction attendue : blur a reset à 10:00 ou plus
    const val = await evisc.inputValue();
    expect(val >= "10:00" || val === "").toBeTruthy();
  }
});
