import { test, expect } from "@playwright/test";
import dayjs from "dayjs";
import "dayjs/locale/fr";
dayjs.locale("fr");
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

// Scenario 104 — Offline create + online auto-sync.
// Local-first: user creates/edits offline, when back online the PQueue drains to server.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Création hors-ligne puis sync auto au retour en ligne", async ({ page, context }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  // Go offline
  await context.setOffline(true);

  await page.getByTitle("Nouvelle fiche").click();
  await expect(page.getByText("Date de mise à mort (et d'éviscération) *")).toBeVisible();
  await page.getByRole("button", { name: dayjs().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // Bloc 2 — one carcasse
  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter la carcasse" }).click();

  // Feedback visible even offline (local-first)
  await expect(page.getByText(/MM-\d+-\d+/).first()).toBeVisible();

  // Back online -> sync should happen
  await context.setOffline(false);

  // Reload and verify persistence after sync
  await page.goto("http://localhost:3290/app/chasseur");
  await expect(page.getByText(/ZACH-/).first()).toBeVisible({ timeout: 15000 });
});
