import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../scripts/connect-with";

// test.beforeAll(async () => {
//   await resetDb();
// });

test.describe("Connexion sur desktop", () => {
  test("Connexion avec compte examinateur initial", async ({ page }) => {
    await connectWith(page, "examinateur@example.fr");
    await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
    await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
    await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).toBeVisible();
  });

  test("Connexion avec compte premier détenteur", async ({ page }) => {
    await connectWith(page, "premier-detenteur@example.fr");
    await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
    await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
    await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).toBeVisible();
  });
});

test("Connexion avec compte collecteur pro", async ({ page }) => {
  await connectWith(page, "collecteur-pro@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
  await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).toBeVisible();
});

test("Connexion avec compte établissement de traitement", async ({ page }) => {
  await connectWith(page, "etg@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
  await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).toBeVisible();
});

test("Connexion avec compte svi", async ({ page }) => {
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await expect(page.getByRole("heading", { name: "Vous n'avez pas encore de" })).toBeVisible();
  await expect(page.locator("#content").getByRole("button", { name: "Nouvelle fiche" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre à jour" }).nth(1)).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtrer" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Action sur les fiches sélectionnées" }).first()).toBeVisible();
});
