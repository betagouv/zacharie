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
  await resetDb("PREMIER_DETENTEUR");
});

test.skip("Profil informations de chasse : associations + partenaires + CCGs persistés", async ({ page }) => {
  // SKIP: complex multi-page profil flow + CCG creation requires DDECPP registry — need user input on selectors
  await connectWith(page, "premier-detenteur@example.fr");

  // Associations
  await page.goto("http://localhost:3290/app/chasseur/profil/associations-de-chasse");
  const associationInput = page.getByRole("textbox").first();
  await associationInput.scrollIntoViewIfNeeded();
  await associationInput.fill("Association Test 32");
  await associationInput.blur();
  const addAssoc = page.getByRole("button", { name: /Ajouter/i }).first();
  if (await addAssoc.count()) await addAssoc.click();

  // Partenaires
  await page.goto("http://localhost:3290/app/chasseur/profil/partenaires");
  // TODO: verify UI/selectors

  // CCGs
  await page.goto("http://localhost:3290/app/chasseur/profil/ccgs");
  const addCcg = page.getByRole("button", { name: /Ajouter|Renseigner.*chambre froide/i }).first();
  await addCcg.scrollIntoViewIfNeeded();
  await addCcg.click();
  await page.getByText(/Oui, ma chambre froide a un numéro d'identification/i).click();
  await page.getByRole("textbox", { name: /Numéro d'identification/i }).fill("CCG-32");
  await page.getByRole("button", { name: /Ajouter cette chambre froide/i }).click();
  await expect(page.getByText(/CCG-32/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/CCG-32/)).toBeVisible();
});
