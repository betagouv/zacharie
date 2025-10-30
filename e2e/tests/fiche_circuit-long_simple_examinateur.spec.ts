import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";
import { NETWORK_PRESETS } from "../utils/network-throttling";

// test.describe.configure({ mode: "serial" }); // TODO: remove this and make the tests parallel

test.describe("Fiches examinateur initial", () => {
  test.use({
    viewport: { width: 350, height: 667 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeAll(async () => {
    await resetDb("EXAMINATEUR_INITIAL");
  });

  test("Création d'une fiche", async ({ page }) => {
    await connectWith(page, "examinateur@example.fr");
    await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByRole("button", { name: "Nouvelle fiche" }).nth(1).click();
    await expect(page.getByRole("heading", { name: "Examen initial Étape 1 sur" })).toBeVisible();
    await expect(page.getByText("Étape suivante : Validation")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Action de l'Examinateur" })).toBeVisible();
    await expect(page.locator("summary")).toBeVisible();
    await expect(page.getByText("* Les champs marqués d'un astérisque (*) sont obligatoires")).toBeVisible();
    await page.getByText("Date de mise à mort (et d'éviscération) *").click();
    await page.getByRole("button", { name: "Cliquez ici pour définir la date du jour", exact: true }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByRole("textbox", { name: "Commune de mise à mort *" }).fill("CHASS");
    await page.getByRole("button", { name: "CHASSENARD" }).click();
    await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).fill("12:12");
    await page.getByRole("textbox", { name: "Heure de mise à mort de la" }).blur();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByLabel("Nouvelle carcasse / lot de").selectOption("Daim");
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Votre chasse n'a pas de dispositif de marquage ? Cliquez ici pour utiliser" })
      .click();
    await page.getByRole("button", { name: "Enregistrer la carcasse" }).click();
    await expect(page.getByText("Synchronisation en cours")).toBeVisible();
    await expect(page.getByText("Synchronisation en cours")).not.toBeVisible();
    await page.getByRole("textbox", { name: "Heure d'éviscération de la" }).fill("12:14");
    await page.getByRole("textbox", { name: "Heure d'éviscération de la" }).blur();
    await page.getByRole("button", { name: "Cliquez ici pour définir la date du jour et maintenant" }).click();
    await page.getByText("Je, Martin Marie, certifie qu").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(page.getByRole("button", { name: "Enregistrer la fiche", exact: true })).not.toBeDisabled();
    await page.getByRole("button", { name: "Enregistrer la fiche", exact: true }).click();
    await page.getByLabel("Qui est le premier détenteur ?").selectOption("Pierre Petit - 75000 Paris");
    await page.getByRole("button", { name: "Valider l’examen initial" }).click();
    await expect(page.getByRole("heading", { name: "Attribution effectuée" })).toBeVisible();
    // get fei id
    const feiId = page.url().split("/").pop()!;
    console.log(feiId);
    await page.getByRole("link", { name: "Voir toutes mes fiches" }).click();
    await expect(page.getByRole("link", { name: feiId })).toBeVisible();
    await expect(page.getByRole("link", { name: feiId })).toContainText("En cours");
    await expect(page.getByRole("link", { name: feiId })).toContainText("chassenard");
    await expect(page.getByRole("link", { name: feiId })).toContainText("4 daims");
    await expect(page.getByRole("link", { name: feiId })).toContainText("À renseigner");
    // await page.getByRole("button", { name: "Menu" }).click();
    // await page.getByRole("button", { name: "Mon profil" }).click();
    // await page.getByRole("button", { name: "Déconnecter examinateur@example.fr" }).click();
  });
});
