import { test, expect } from "@playwright/test";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
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

  // Create a new fiche — should work locally even offline
  await page.getByRole("button", { name: "Nouvelle fiche" }).first().click();
  await expect(page.getByText("Date de mise à mort (et d'éviscération) *")).toBeVisible();

  // Select today's date
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();

  // Fill commune
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();

  // The fiche was created locally. The URL already contains the ZACH- fiche number.
  await expect(page).toHaveURL(/ZACH-/);

  // Capture the fiche URL to check later
  const ficheUrl = page.url();
  const feiNumero = ficheUrl.match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  // Back online -> sync should happen
  await context.setOffline(false);

  // Navigate home and verify the fiche link is visible after sync
  await page.goto("http://localhost:3290/app/chasseur");
  // The fiche should appear as a link on the dashboard
  await expect(page.getByRole("link", { name: feiNumero! }).first()).toBeVisible({ timeout: 15000 });
});
