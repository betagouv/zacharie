import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

// Scenario 105 — Role-based route access matrix.
// Each role layout (/chasseur, /etg, /svi, /collecteur, /circuit-court) redirects to
// /app/connexion via <Navigate> if the user doesn't match the layout's role.
// See app-local-first-react-router/src/routes/chasseur/chasseur-layout.tsx.

test.beforeAll(async () => {
  await resetDb();
});

test.use({ launchOptions: { slowMo: 50 } });

type RoleMatrix = {
  email: string;
  allowed: string; // path prefix for the layout the user can access
  forbidden: string[]; // paths from OTHER role layouts
};

const ROLES: RoleMatrix[] = [
  {
    email: "examinateur@example.fr",
    allowed: "/app/chasseur",
    forbidden: ["/app/etg", "/app/svi", "/app/collecteur", "/app/circuit-court"],
  },
  {
    email: "etg-1@example.fr",
    allowed: "/app/etg",
    forbidden: ["/app/chasseur", "/app/svi", "/app/collecteur", "/app/circuit-court"],
  },
  {
    email: "svi@example.fr",
    allowed: "/app/svi",
    forbidden: ["/app/chasseur", "/app/etg", "/app/collecteur", "/app/circuit-court"],
  },
  {
    email: "collecteur-pro@example.fr",
    allowed: "/app/collecteur",
    forbidden: ["/app/chasseur", "/app/etg", "/app/svi", "/app/circuit-court"],
  },
  {
    email: "commerce-de-detail@example.fr",
    allowed: "/app/circuit-court",
    forbidden: ["/app/chasseur", "/app/etg", "/app/svi", "/app/collecteur"],
  },
];

for (const role of ROLES) {
  test(`${role.email} ne peut accéder qu'à ${role.allowed}`, async ({ page }) => {
    await connectWith(page, role.email);
    // After login, user should land on their allowed layout
    await expect(page).toHaveURL(new RegExp(role.allowed));

    for (const path of role.forbidden) {
      await page.goto(`http://localhost:3290${path}`);
      // Should redirect to /app/connexion (per <Navigate to="/app/connexion" />)
      // OR redirect to user's allowed path if the guard sends them "home".
      await expect(page).toHaveURL(
        new RegExp(`(/app/connexion|${role.allowed})`),
        { timeout: 10000 },
      );
      // Must NOT remain on the forbidden layout path
      expect(page.url()).not.toContain(path + "/");
    }
  });
}
