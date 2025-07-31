import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

// test.beforeAll(async () => {
//   await resetDb();
// });

test("Connexion avec succès", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
});

test("Connexion avec mot de passe incorrect", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr", "secret-mauvais-secretasdfdsaf");
  await expect(page.getByText("Le mot de passe est incorrect")).toBeVisible();
});

test("Création de compte avec email existant", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Créer un compte" }).first().click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur@example.fr");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-ce");
  await page.getByText("Afficher").click();
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByText("Un compte existe déjà avec").click();
  await page.getByRole("link", { name: "Cliquez ici pour vous" }).click();
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
});

test.describe("Connexion avec email incorrect", () => {
  test.beforeAll(async () => {
    await resetDb();
  });

  test("Connexion avec email incorrect", async ({ page }) => {
    await connectWith(page, "examinateur-pas-encore-existe@example.fr", "secret-mauvais-secret");
    await page.getByText("L'email est incorrect, ou vous n'avez pas encore de compte").click();
    await page.getByRole("link", { name: "Cliquez ici pour en créer un" }).click();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { name: "Renseignez votre activité" })).toBeVisible();
  });
});
