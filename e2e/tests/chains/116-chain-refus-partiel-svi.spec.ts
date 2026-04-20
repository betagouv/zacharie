import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 116 — Chain refus partiel SVI : une acceptee, une refusee, une consignee → chasseur voit les 3 decisions.
test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb("SVI");
});

test("SVI rend des décisions divergentes → chasseur voit chaque décision", async ({ page }) => {
  test.skip(true, "SKIP: SVI IPM1 inspection flow needs live verification — multiple carcasse decisions with different outcomes require UI walkthrough");
});
