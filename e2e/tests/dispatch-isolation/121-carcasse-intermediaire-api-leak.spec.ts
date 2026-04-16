import { test } from "@playwright/test";

// Scenario 121 — CarcasseIntermediaire API : fuite impossible.
// Tenter GET /carcasse-intermediaire/:id avec l'ID d'un autre intermédiaire → 403/404.
// TODO: implement direct API test once ID of a foreign CarcasseIntermediaire can be resolved
// from seed data or through an admin endpoint. Requires auth cookie forwarding + composite ID
// (fei_numero + zacharie_carcasse_id + intermediaire_id) — see
// app-local-first-react-router/src/utils/get-carcasse-intermediaire-id.ts.

test.skip("API : accès cross-intermédiaire interdit (403/404)", async () => {
  // TODO: implement direct API test
});
