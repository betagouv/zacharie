import { test } from "@playwright/test";

// Scenario 124 — Deux chaînes SVI parallèles.
// ETG 1 → SVI 1, ETG 2 → SVI 2 ; SVI 2 ne voit que la branche ETG 2.
// SKIPPED: The seed only has one SVI user (svi@example.fr) and one SVI entity.
// Testing parallel SVI chains requires a second SVI entity and user which are not seeded.
// The single-branch SVI isolation is covered by spec 123.

test.skip("SVI 1 et SVI 2 voient chacun leur branche seulement", async () => {
  // TODO: unskip when a second SVI entity/user is added to the seed
});
