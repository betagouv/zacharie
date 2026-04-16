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

test("Edition CCG : modification persistée", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await page.goto("http://localhost:3290/app/chasseur/profil/ccgs");

  // Créer un CCG
  const addBtn = page.getByRole("button", { name: /Ajouter|Renseigner.*chambre froide/i }).first();
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.getByText(/Oui, ma chambre froide a un numéro d'identification/i).click();
  await page.getByRole("textbox", { name: /Numéro d'identification/i }).fill("CCG-EDIT");
  await page.getByRole("button", { name: /Ajouter cette chambre froide/i }).click();
  await expect(page.getByText(/CCG-EDIT/)).toBeVisible();

  // Cliquer dessus pour éditer
  await page.getByRole("link", { name: /CCG-EDIT/ }).click(); // TODO: verify selector (link vs button)
  await expect(page).toHaveURL(/\/app\/chasseur\/profil\/ccgs\/.+/);

  const input = page.getByRole("textbox", { name: /Numéro d'identification|Nom/i }).first();
  await input.scrollIntoViewIfNeeded();
  await input.fill("CCG-EDIT-MODIFIE");
  await input.blur();
  const save = page.getByRole("button", { name: /Enregistrer|Sauver/i }).first();
  if (await save.count()) {
    await save.click();
  }

  await page.reload();
  await expect(page.getByRole("textbox", { name: /Numéro d'identification|Nom/i }).first()).toHaveValue(
    "CCG-EDIT-MODIFIE",
  );
});
