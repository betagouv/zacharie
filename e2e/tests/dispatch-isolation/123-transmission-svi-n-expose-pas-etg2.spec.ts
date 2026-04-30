import { test } from '@playwright/test';

// Scenario 123 — Transmission ETG 1 → SVI n'expose pas les carcasses ETG 2.
// SKIPPED (deferred): UI flow involves accepting each carcasse individually (click → modal →
// "Carcasse acceptée" → close), then setting a date and selecting the SVI. Fragile under
// load, especially with the gros/petit gibier modal-timing differences in DSFR.
// User keeps as a UI test (no API conversion) as a regression guard for an upcoming backend
// refactor — to be implemented post-refactor when modal timings are more stable.
// Per-branch isolation at FEI level is already covered by 117, 118, 122. Single-branch
// ETG→SVI flow is covered by 111.

test.skip("SVI destinataire d'ETG 1 ne voit que les 2 carcasses d'ETG 1", async () => {
  // TODO: implement post-backend-refactor with stable carcasse-acceptance modal flow
});
