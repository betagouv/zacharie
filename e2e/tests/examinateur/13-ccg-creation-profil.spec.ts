import { test, expect } from "@playwright/test";
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

test("CCG : création depuis profil → visible après reload", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await page.goto("http://localhost:3290/app/chasseur/profil/ccgs");

  const addBtn = page.getByRole("button", { name: /Ajouter|Renseigner.*chambre froide/i }).first();
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  await page.getByText(/Oui, ma chambre froide a un numéro d'identification/i).click();
  await page.getByRole("textbox", { name: /Numéro d'identification/i }).fill("CCG-NEW");
  await page.getByRole("button", { name: /Ajouter cette chambre froide/i }).click();

  await expect(page.getByText(/CCG-NEW/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/CCG-NEW/)).toBeVisible();
});
