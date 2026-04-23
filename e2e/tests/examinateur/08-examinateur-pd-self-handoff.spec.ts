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

test.skip("Examinateur == PD via CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY — self-handoff", async ({ page }) => {
  // SKIP: entity PD selector needs live verification
  await connectWith(page, "examinateur-premier-detenteur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  await page.getByRole("button", { name: "Nouvelle fiche" }).first().click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();

  // Sélectionner l'association de chasseurs comme PD (pill button)
  await page.getByRole("button", { name: /Association de chasseurs/i }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  // Bloc 2 — 1 carcasse
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

  // Validation
  await page.getByRole("button", { name: "Définir comme étant la date du jour et maintenant" }).click();
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();
  await page.getByRole("button", { name: "Transmettre", exact: true }).click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  // Même session : ouvrir la fiche — en tant que PD, on voit le dispatch
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`);

  // L'utilisateur peut prendre en charge la fiche
  const prendreEnCharge = page.getByRole("button", { name: /Prendre en charge/i });
  await expect(prendreEnCharge).toBeVisible({ timeout: 10000 });
  await prendreEnCharge.click();

  // Sélectionner ETG 1 comme prochain détenteur (pill button)
  const etg1Pill = page.getByRole("button", { name: /ETG 1/i });
  await etg1Pill.scrollIntoViewIfNeeded();
  await etg1Pill.click();

  // Pas de stockage
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();

  // Je transporte moi-même
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  const transmettre = page.getByRole("button", { name: "Transmettre" });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 10000 });
});
