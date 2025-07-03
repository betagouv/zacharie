import { test, expect } from "@playwright/test";

// test.beforeAll(async () => {
//   await populate();
// });

test("Try to login and success", async ({ page }) => {
  await page.goto("http://localhost:3290/");
  await page.locator("#fr-header-header-with-quick-access-items-quick-access-item-0").click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).click();
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).fill("examinateur@example.fr");
  await page.getByRole("textbox", { name: "Mon email Renseignez votre" }).press("Tab");
  await page.getByRole("textbox", { name: "Mon mot de passe Veuillez" }).fill("secret-secret");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
});
