import { test } from "@playwright/test";

// Scenario 123 — Transmission ETG 1 → SVI n'expose pas les carcasses ETG 2.
// SKIPPED: The full ETG→SVI transmission workflow requires accepting all carcasses
// individually (clicking each one, selecting "Carcasse acceptée", closing modals),
// then setting a date and selecting the SVI. This multi-step flow with multiple
// carcasses is fragile in E2E and is already covered by spec 111 (single-branch).
// The per-branch isolation at the FEI level is verified by specs 117, 118, 122.

test.skip("SVI destinataire d'ETG 1 ne voit que les 2 carcasses d'ETG 1", async () => {
  // TODO: implement when individual carcasse acceptance selectors are stabilized
  // for multi-carcasse ETG→SVI flow
});
