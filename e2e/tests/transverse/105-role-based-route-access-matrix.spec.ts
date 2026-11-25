import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb();
});

test.use({ launchOptions: { slowMo: 50 } });

type RoleMatrix = {
  email: string;
  allowed: string;
  forbidden: string[];
};

const ROLES: RoleMatrix[] = [
  {
    email: 'examinateur@example.fr',
    allowed: '/app/chasseur',
    forbidden: ['/app/etg', '/app/svi', '/app/collecteur', '/app/circuit-court'],
  },
  {
    email: 'etg-1@example.fr',
    allowed: '/app/etg',
    forbidden: ['/app/chasseur', '/app/svi', '/app/collecteur', '/app/circuit-court'],
  },
  {
    email: 'svi@example.fr',
    allowed: '/app/svi',
    forbidden: ['/app/chasseur', '/app/etg', '/app/collecteur', '/app/circuit-court'],
  },
  {
    email: 'collecteur-pro@example.fr',
    allowed: '/app/collecteur',
    forbidden: ['/app/chasseur', '/app/etg', '/app/svi', '/app/circuit-court'],
  },
  {
    email: 'commerce-de-detail@example.fr',
    allowed: '/app/circuit-court',
    forbidden: ['/app/chasseur', '/app/etg', '/app/svi', '/app/collecteur'],
  },
];

for (const role of ROLES) {
  test(`${role.email} ne peut accéder qu'à ${role.allowed}`, async ({ page }) => {
    await connectWith(page, role.email);
    await expect(page).toHaveURL(new RegExp(role.allowed));

    for (const path of role.forbidden) {
      await page.goto(`http://localhost:3290${path}`);
      await expect(page).toHaveURL(new RegExp(`(/app/connexion|${role.allowed})`), { timeout: 10000 });
      expect(page.url()).not.toContain(path + '/');
    }
  });
}
