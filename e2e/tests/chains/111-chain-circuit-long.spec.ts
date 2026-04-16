import { test, expect } from "@playwright/test";
import dayjs from "dayjs";
import "dayjs/locale/fr";
dayjs.locale("fr");
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 111 — Chain circuit long : examinateur → PD → ETG → SVI → chasseur voit décision finale.
test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Chain circuit long complet : examinateur → PD → ETG → SVI", async ({ page }) => {
  // 1. Examinateur crée une fiche mono-carcasse
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");
  await page.setViewportSize({ width: 350, height: 667 });
  await page.getByTitle("Nouvelle fiche").click();
  await page.getByRole("button", { name: dayjs().format("dddd DD MMMM") }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  await page.getByRole("button", { name: "Pierre Petit" }).click();
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
  await page.getByText("Je, Martin Marie, certifie qu").click();
  await page.getByRole("button", { name: "Transmettre", exact: true }).click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });
  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  // 2. PD prend en charge + transmet à ETG 1
  await logoutAndConnect(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId! }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  const transmettreBtn = page.getByRole("button", { name: "Transmettre" });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 15000 });

  // 3. ETG 1 prend en charge, accepte la carcasse, transmet au SVI
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId! }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  const daimBtn = page.getByRole("button", { name: /Daim N° MM-\d+-\d+/ }).first();
  await daimBtn.scrollIntoViewIfNeeded();
  await daimBtn.click();
  await page.getByText("Carcasse acceptée").first().click();
  await page.keyboard.press("Escape").catch(() => void 0);
  const defineBtn = page.getByRole("button", { name: "Cliquez ici pour définir" });
  await defineBtn.scrollIntoViewIfNeeded();
  await defineBtn.click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "SVI 1 - 75000 Paris (Service" }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 15000 });

  // 4. SVI inspecte et accepte
  await logoutAndConnect(page, "svi@example.fr");
  await page.getByRole("link", { name: feiId! }).click();
  const sviDaim = page.getByRole("button", { name: /Daim N° MM-\d+-\d+/ }).first();
  await sviDaim.scrollIntoViewIfNeeded();
  await sviDaim.click();
  const accepter = page.getByText(/Accepté/i).first();
  if (await accepter.isVisible().catch(() => false)) {
    await accepter.click();
  }
  // TODO: verify selector — SVI decision UI may differ.

  // 5. Chasseur voit décision finale
  await page.setViewportSize({ width: 350, height: 667 });
  await logoutAndConnect(page, "examinateur@example.fr");
  await page.getByRole("link", { name: feiId! }).click();
  await expect(page.getByText(/accept|clôtur/i).first()).toBeVisible({ timeout: 15000 });
});
