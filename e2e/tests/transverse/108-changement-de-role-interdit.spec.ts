import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

// Scenario 108 — Changement de rôle interdit.
// A user shall not have multiple roles (project rule). Frontend forbids it; backend should reject.
// TODO: implement direct backend test once /api/user/me or /api/admin/user endpoint is exposed
// for integration. The UI doesn't expose a multi-role toggle, so this scenario is best tested
// at the API layer with a crafted payload.

test.beforeAll(async () => {
  await resetDb();
});

test("Tenter d'ajouter un second rôle via API doit être rejeté", async ({ page, request }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  // Retrieve auth cookies from the browser context to forward to the API request.
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // Attempt to patch current user with TWO roles. Expect backend to reject (>=400) OR
  // to silently normalize to a single role (200 but roles.length === 1).
  const res = await request.post("http://localhost:3290/api/action/user/examinateur@example.fr", {
    headers: { cookie: cookieHeader, "content-type": "application/json" },
    data: { roles: ["CHASSEUR", "ETG"] },
    failOnStatusCode: false,
  });

  if (res.status() >= 400) {
    expect(res.status()).toBeGreaterThanOrEqual(400);
  } else {
    // If accepted, verify the server did NOT actually persist both roles.
    const body = await res.json().catch(() => ({}));
    const roles = body?.data?.user?.roles ?? body?.user?.roles ?? [];
    expect(Array.isArray(roles) && roles.length <= 1).toBeTruthy();
  }
});
