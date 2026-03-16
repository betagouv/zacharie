import { test, expect } from "@playwright/test";
import dayjs from "dayjs";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: {
    slowMo: 100,
  },
});

test.beforeAll(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Création d'une fiche", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await page.getByTitle("Nouvelle fiche").click();
  await page.getByText("Date de mise à mort (et d'éviscération) *").click();
  await page.getByRole("button", { name: "Cliquez ici pour définir la date du jour", exact: true }).click();
  await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
  await page.getByRole("button", { name: "CHASSENARD" }).click();
  // Select premier détenteur
  await page.getByRole("button", { name: "Pierre Petit" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  // Bloc 2 — Carcasses
  await page
    .getByRole("textbox", { name: "Heure de mise à mort de la" })
    .fill(dayjs().startOf("day").add(1, "hour").format("HH:mm"));
  await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).blur();
  await page.getByLabel("Espèce (grand et petit gibier)").selectOption("Daim");
  await page
    .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
    .click();
  await page.getByRole("button", { name: "Ajouter une carcasse" }).click();
  await page
    .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
    .click();
  await page.getByRole("button", { name: "Ajouter une carcasse" }).click();
  await page
    .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
    .click();
  await page.getByRole("button", { name: "Ajouter une carcasse" }).click();
  await page
    .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
    .click();
  await page.getByRole("button", { name: "Ajouter une carcasse" }).click();
  await page
    .getByRole("textbox", { name: "Heure d'éviscération de la" })
    .fill(dayjs().startOf("day").add(2, "hour").format("HH:mm"));
  await page.getByRole("textbox", { name: "Heure d'éviscération de la" }).blur();
  // Bloc 4 — Validation
  await page.getByRole("button", { name: "Cliquez ici pour définir la date du jour et maintenant" }).click();
  await page.getByText("Je, Martin Marie, certifie qu").click();
  await expect(
    page.getByRole("button", { name: "Enregistrer et transmettre la fiche", exact: true }),
  ).not.toBeDisabled();
  await page.getByRole("button", { name: "Enregistrer et transmettre la fiche", exact: true }).click();
  await expect(page.getByText(/Attribution effectu/i).first()).toBeVisible({ timeout: 10000 });
  // get fei id
  const feiId = page.url().split("/").pop()!;
  await page.getByRole("link", { name: "Voir toutes mes fiches" }).click();
  await expect(page.getByRole("link", { name: feiId })).toBeVisible();
  await expect(page.getByRole("link", { name: feiId })).toContainText("En cours");
  await expect(page.getByRole("link", { name: feiId })).toContainText("chassenard");
  await expect(page.getByRole("link", { name: feiId })).toContainText("4 daims");
  await expect(page.getByRole("link", { name: feiId })).toContainText("À renseigner");
});
