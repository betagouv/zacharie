import { expect, type Page } from "@playwright/test";

export async function connectWith(page: Page, email: string, password: string = "secret-secret") {
  await page.goto("http://localhost:3290/");
  await page.getByRole("link", { name: "Se connecter" }).first().click();
  await page.getByRole("button", { name: "Me connecter" }).waitFor({ state: "visible" });
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill(email);
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill(password);
  await page.getByRole("button", { name: "Me connecter" }).click();
}
