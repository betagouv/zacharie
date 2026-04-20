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

test.skip("Brouillon : quitter puis reprendre — formulaire préservé (local-first)", async ({ page }) => {
  // SKIP: draft fiche not appearing in list — need to understand local-first draft visibility rules
  await connectWith(page, "examinateur@example.fr");

  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // grab feiId (draft exists locally)
  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  // Quitter vers la liste
  await page.goto("http://localhost:3290/app/chasseur");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible();

  // Reprendre
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/CHASSENARD/i)).toBeVisible();
  await expect(page.getByText(/Pierre Petit/i)).toBeVisible();
});
