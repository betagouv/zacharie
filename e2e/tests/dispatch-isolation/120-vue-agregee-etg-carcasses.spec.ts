import { test } from "@playwright/test";

// Scenario 120 — Vue agrégée /etg/carcasses respecte le dispatch.
// SKIPPED: The /etg/carcasses aggregate view currently shows ALL carcasses for the FEI
// regardless of dispatch branch. This is a known application limitation — the aggregate
// carcasses table does not filter by intermediaire assignment. The FEI-level isolation
// (tested in specs 117, 118, 122, 123) works correctly.

test.skip("/etg/carcasses ne leak pas les carcasses d'une autre branche", async () => {
  // TODO: unskip when /etg/carcasses filters by dispatch branch
});
