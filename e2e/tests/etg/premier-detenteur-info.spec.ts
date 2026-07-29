import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  launchOptions: {
    slowMo: 100,
  },
});

test("Premier détenteur = examinateur initial : l'ETG voit le nom et le contact de l'examinateur", async ({
  page,
}) => {
  await resetDb('ETG_PD_EXAMINATEUR');
  const feiId = 'ZACH-20250707-QZ6E0-165243';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible();
  await page.getByRole('link', { name: feiId }).click();

  // L'étape « Premier détenteur » de la frise affiche les mêmes infos que l'étape « Examinateur initial »
  // (Marie Martin, son email, son numéro CFEI) car l'examinateur est aussi le premier détenteur.
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: Parcours de la fiche
        - text: Marie Martin
        - paragraph: Examinateur initial
        - link /\\d+/:
          - /url: tel:0606060601
        - link "examinateur@example.fr":
          - /url: mailto:examinateur@example.fr
        - text: /N° CFEI CFEI-\\d+-\\d+-\\d+ \\d+ Paris Marie Martin/
        - paragraph: Premier détenteur
        - link /\\d+/:
          - /url: tel:0606060601
        - link "examinateur@example.fr":
          - /url: mailto:examinateur@example.fr
        - text: /N° CFEI CFEI-\\d+-\\d+-\\d+ \\d+ Paris/
      `);
});

test("Premier détenteur = association de chasse : l'ETG voit les infos de l'association", async ({
  page,
}) => {
  await resetDb('ETG_PD_ASSOCIATION');
  const feiId = 'ZACH-20250707-QZ6E0-165244';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible();
  await page.getByRole('link', { name: feiId }).click();

  // L'étape « Premier détenteur » de la frise affiche les infos de l'entité association : raison sociale,
  // SIRET et ville — pas celles d'un individu.
  await expect(page.locator('#content')).toMatchAriaSnapshot(`
      - group:
        - heading "Données de traçabilité" [level=3]
        - paragraph: Parcours de la fiche
        - text: /Association de chasseurs/
        - paragraph: Premier détenteur
        - text: /SIRET \\d+ \\d+ Paris/
      `);

  // L'individu premier-détenteur par défaut ne doit pas apparaître.
  await expect(page.getByText('premier-detenteur@example.fr')).toHaveCount(0);
  await expect(page.getByText('Pierre Petit')).toHaveCount(0);
});
