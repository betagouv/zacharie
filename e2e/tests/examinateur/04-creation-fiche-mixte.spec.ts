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

test("Création fiche mixte — 3 daims + 10 pigeons", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");

  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // 3 daims
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await page.getByRole("button", { name: "Ajouter une autre carcasse" }).click();
    }
    await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
    await page.getByRole("button", { name: "Utiliser" }).click();
    await page.getByRole("button", { name: "Ajouter la carcasse" }).click();
  }

  // 10 pigeons (lot)
  await page.getByRole("button", { name: "Ajouter une autre carcasse" }).click();
  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Pigeons");
  const quantite = page.getByLabel(/Nombre de carcasses dans le lot/);
  await quantite.scrollIntoViewIfNeeded();
  await quantite.fill("10");
  await quantite.blur();
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter le lot de carcasses" }).click();

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

  await page.getByRole("button", { name: "Définir comme étant la date du jour et maintenant" }).click();
  await page.getByText("Je, Martin Marie, certifie qu").click();
  await page.getByRole("button", { name: "Transmettre", exact: true }).click();

  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  await page.getByRole("link", { name: "Voir toutes les fiches" }).click();
  const link = page.getByRole("link", { name: feiId });
  await expect(link).toContainText("3 daims");
  await expect(link).toContainText("10 pigeons");
});
