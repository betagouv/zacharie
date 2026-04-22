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

test("Fiche avec anomalies abats & carcasse — visible au rouvrir", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");

  // Step 1: Create fiche with 1 daim
  await page.getByRole("button", { name: "Nouvelle fiche" }).first().click();
  await page.getByRole("button", { name: dayjs.utc().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).first().click();

  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page.getByRole("button", { name: "Utiliser" }).click();
  await page.getByRole("button", { name: "Ajouter la carcasse" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 2: Open the carcasse detail to add anomalies
  await page
    .getByRole("button", { name: /Daim N°/ })
    .first()
    .click();

  // Add anomalie abats via referentiel button
  const ajouterAbats = page.getByRole("button", { name: "Ajouter depuis le référentiel des anomalies abats" });
  await ajouterAbats.scrollIntoViewIfNeeded();
  await ajouterAbats.click();
  // Expand category then select anomaly
  await page.getByText("Appareil respiratoire (sinus/trachée/poumon)").click();
  await page.getByText("Abcès ou nodules").first().click();
  // Close the modal
  await page.getByRole("button", { name: "Fermer" }).last().click();

  // Go back to fiche
  const retourBtn = page.getByRole("button", { name: "Enregistrer et retourner à la fiche" });
  await retourBtn.scrollIntoViewIfNeeded();
  await retourBtn.click();

  // Step 3: Advance past carcasses bloc
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 4: Fill hours and transmit
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

  // Step 5: Reopen and verify anomalies persisted — click into carcasse detail
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  const carcasseBtn = page.getByRole("button", { name: /Daim N°/ }).first();
  await expect(carcasseBtn).toBeVisible({ timeout: 10000 });
  await carcasseBtn.click();
  // On the detail page, the anomaly section should show the selected anomaly
  await expect(page.getByText(/Abcès ou nodules/i)).toBeVisible({ timeout: 10000 });
});
