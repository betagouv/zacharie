import { expect, Page } from "@playwright/test";

export async function clickOnEmptyReactSelect(page: Page, name: string, text: string) {
  await page.locator(`.${name}__dropdown-indicator`).click();
  await page.locator(`.${name}__menu`).getByText(text, { exact: true }).click();
}

export async function changeReactSelectValue(page: Page, name: string, text: string) {
  await page.locator(`.${name}__dropdown-indicator`).click();
  await page.locator(`.${name}__menu`).getByText(text, { exact: true }).click();
}
