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

test("Edition carcasse depuis /chasseur/carcasse/:fei/:id", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");

  // Crée une fiche minimale pour avoir un carcasse id
  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter la carcasse" }).click();

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  // Ouvrir détail carcasse depuis la fiche
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  await page.getByRole("button", { name: /Daim N°/ }).first().click();

  // Ajouter une anomalie
  const abces = page.getByText("Abcès ou nodules").first();
  await abces.scrollIntoViewIfNeeded();
  await abces.click();

  // Retour liste de carcasses — anomalie visible
  const close = page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button");
  await close.click();
  await expect(page.getByText(/Abcès ou nodules/i).first()).toBeVisible();
});
