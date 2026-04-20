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

test("Création fiche grand gibier mono-carcasse — 1 daim", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // Bloc 2 — 1 seule carcasse
  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter la carcasse" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Heures
  await page
    .getByRole("textbox", { name: "Heure de mise à mort de la" })
    .fill(dayjs().startOf("day").add(1, "hour").format("HH:mm"));
  await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).blur();
  await page
    .getByRole("textbox", { name: "Heure d'éviscération de la" })
    .fill(dayjs().startOf("day").add(2, "hour").format("HH:mm"));
  await page.getByRole("textbox", { name: "Heure d'éviscération de la" }).blur();

  // Bloc 4 — Validation
  await page.getByRole("button", { name: "Définir comme étant la date du jour et maintenant" }).click();
  await page.getByText("Je, Martin Marie, certifie qu").click();

  const transmettre = page.getByRole("button", { name: "Transmettre", exact: true });
  await expect(transmettre).not.toBeDisabled();
  await transmettre.click();

  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });
  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  await page.getByRole("link", { name: "Voir toutes les fiches" }).click();
  await expect(page.getByRole("link", { name: feiId })).toContainText("1 daim");
});
