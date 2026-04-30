import { test } from '@playwright/test';

// Scenario 124 — Deux chaînes SVI parallèles.
// ETG 1 → SVI 1, ETG 2 → SVI 2 ; each SVI only sees its own branch.
// SKIPPED (deferred): 5-login chain test (PD → ETG 1 → ETG 2 → SVI 1 → SVI 2). The DSFR
// modal timing for carcasse acceptance is flaky (auto-close after radio click vs. manual
// Enregistrer varies between gros gibier and petit gibier). User keeps as a UI test (no API
// conversion) as a regression guard for an upcoming backend refactor — to be implemented
// post-refactor when modal timings are more stable.
// Single-branch SVI isolation is covered by spec 123.

test.skip('SVI 1 et SVI 2 voient chacun leur branche seulement', async () => {
  // TODO: implement post-backend-refactor with stable carcasse-acceptance modal flow
});
