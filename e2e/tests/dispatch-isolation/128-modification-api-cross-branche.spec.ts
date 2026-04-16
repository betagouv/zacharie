import { test } from "@playwright/test";

// Scenario 128 — Modification carcasse d'une autre branche via API → 403.
// TODO: implement direct API test. Requires:
//   - auth cookie from etg-1@example.fr
//   - zacharie_carcasse_id d'une carcasse dispatchée à ETG 2
//   - POST /api/action/carcasse/:zacharie_carcasse_id avec un payload modifiant la décision
//   - assert response.status() === 403

test.skip("API POST /carcasse/:id d'une autre branche → 403", async () => {
  // TODO: implement direct API test
});
