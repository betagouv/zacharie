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

test("Création fiche petit gibier en lot — 10 pigeons", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");

  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // Bloc 2 — Lot de pigeons
  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Pigeons");
  // Quantité du lot
  const quantite = page.getByLabel(/Nombre de carcasses dans le lot/);
  await quantite.scrollIntoViewIfNeeded();
  await quantite.fill("10");
  await quantite.blur();
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter le lot de carcasses" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Heures — petit gibier only: no éviscération field
  await page
    .getByRole("textbox", { name: "Heure de mise à mort de la" })
    .fill(dayjs().startOf("day").add(1, "hour").format("HH:mm"));
  await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).blur();

  await page.getByRole("button", { name: "Définir comme étant la date du jour et maintenant" }).click();
  await page.getByText("Je, Martin Marie, certifie qu").click();

  await page.getByRole("button", { name: "Transmettre", exact: true }).click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  await page.getByRole("link", { name: "Voir toutes les fiches" }).click();
  await expect(page.getByRole("link", { name: feiId })).toContainText("10 pigeons");
});
