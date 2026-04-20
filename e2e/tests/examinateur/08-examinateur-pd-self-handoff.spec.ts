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
  // SKIP: need to verify how Association de chasseurs entity selector + self-handoff flow works in UI
  // L'utilisateur examinateur-premier-detenteur@example.fr appartient à une Association
  // de chasseurs avec CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY ; il doit pouvoir enchaîner
  // la création (EI) puis le dispatch PD dans la même session.
  await connectWith(page, "examinateur-premier-detenteur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();

  // Assigner le PD à son association de chasse (entity)
  await page.getByRole("button", { name: /Association de chasseurs/i }).click(); // TODO: verify selector
  await page.getByRole("button", { name: "Continuer" }).first().click();

  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter la carcasse" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await page
    .getByRole("textbox", { name: "Heure de mise à mort de la" })
    .fill(dayjs().startOf("day").add(1, "hour").format("HH:mm"));
  await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).blur();
  await page
    .getByRole("textbox", { name: "Heure d'éviscération de la" })
    .fill(dayjs().startOf("day").add(2, "hour").format("HH:mm"));
  await page.getByRole("textbox", { name: "Heure d'éviscération de la" }).blur();

  await page.getByRole("button", { name: "Définir comme étant la date du jour et maintenant" }).click();
  await page.getByText(/Je, .* certifie qu/i).first().click();
  await page.getByRole("button", { name: "Transmettre", exact: true }).click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  // Même session : ouvrir la fiche et enchaîner dispatch PD
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  const prendreEnCharge = page.getByRole("button", { name: /Prendre en charge/i });
  await expect(prendreEnCharge).toBeVisible();
  await prendreEnCharge.click();

  const selectContainer = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectContainer.scrollIntoViewIfNeeded();
  await selectContainer.click();
  await page.getByRole("option", { name: /ETG 1/ }).click();

  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  const transmettre = page.getByRole("button", { name: "Transmettre" });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 10000 });
});
