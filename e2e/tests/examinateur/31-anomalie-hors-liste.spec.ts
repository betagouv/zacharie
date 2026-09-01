import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// Une anomalie absente du référentiel se saisit en texte libre, par deux chemins :
// depuis une recherche infructueuse, et depuis le bloc « Autre anomalie » de la vue racine.
test('Anomalie hors liste — saisie libre, persistée puis retirable', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();

  // Chemin 1 : la recherche ne trouve rien → on propose d'ajouter le texte saisi.
  await page.getByRole('searchbox').fill('trou dans la panse');
  await expect(page.getByText('Aucune anomalie ne correspond')).toBeVisible();
  await page.getByRole('button', { name: /comme anomalie/ }).click();

  // La recherche est vidée, l'anomalie apparaît en pastille dans la vue racine.
  await expect(page.getByRole('button', { name: 'Retirer trou dans la panse' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Anomalies (1)' })).toBeVisible();

  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();

  // Rouvrir la carcasse : l'anomalie libre a persisté (câblage store, pas state local).
  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Anomalies (1)' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Anomalies (1)' }).click();
  await expect(page.getByRole('button', { name: 'Retirer trou dans la panse' })).toBeVisible();

  // Chemin 2 : le bloc « Autre anomalie » de la vue racine.
  await page.getByPlaceholder('Décrivez l’anomalie').fill('sang noir à la découpe');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retirer sang noir à la découpe' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Anomalies (2)' })).toBeVisible();

  // Chemin 3 : le champ libre d'une famille, qui suffixe la valeur par le site.
  await page.getByRole('button', { name: 'Anomalies (2)' }).click();
  await page.getByRole('button', { name: 'Externe' }).click();
  await page.getByPlaceholder('Description de l’anomalie').fill('coloration verdâtre');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  // Dans la famille, la pastille montre le texte seul.
  await expect(page.getByRole('button', { name: 'Retirer coloration verdâtre' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  // La saisie libre de la famille compte dans la pastille de sa famille.
  await expect(page.getByRole('button', { name: 'Externe 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Anomalies (3)' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer' }).click();

  // Rouvrir : la valeur suffixée par le site est bien retrouvée dans sa famille, et pas
  // dans le bloc hors famille de la vue racine.
  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Anomalies (3)' }).click();
  await expect(page.getByRole('button', { name: 'Retirer coloration verdâtre' })).toBeHidden();
  await page.getByRole('button', { name: 'Externe' }).click();
  await expect(page.getByRole('button', { name: 'Retirer coloration verdâtre' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();

  // La pastille retire l'anomalie.
  await page.getByRole('button', { name: 'Retirer trou dans la panse' }).click();
  await expect(page.getByRole('button', { name: 'Retirer trou dans la panse' })).toBeHidden();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Anomalies (2)' })).toBeVisible();
});

// Le petit gibier n'a qu'une famille : le picker s'ouvre directement sur sa liste d'anomalies,
// et c'est cette famille unique qui porte le champ libre.
test('Anomalie hors liste — petit gibier', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Pigeons');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();

  // Un seul champ libre, celui de la famille (pas de doublon avec un bloc hors famille).
  const champLibre = page.getByPlaceholder('Description de l’anomalie');
  await expect(champLibre).toHaveCount(1);

  await champLibre.fill('plumage poisseux');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retirer plumage poisseux' })).toBeVisible();

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Anomalies (1)' })).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter le lot de carcasses' }).click();

  // Persistée après enregistrement, et retirable.
  await page
    .getByRole('button', { name: /Pigeons \(\d+\) N°/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Anomalies (1)' }).click();
  await page.getByRole('button', { name: 'Retirer plumage poisseux' }).click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' })).toBeVisible();
});

// Un texte saisi mais jamais validé ne doit pas être perdu : le CTA de la modale vit hors du
// picker, valider la carcasse doit reprendre le brouillon du champ libre.
test('Anomalie hors liste — texte saisi non validé, repris à l’ajout de la carcasse', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^MM-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter une anomalie (facultatif)' }).click();
  await page.getByRole('button', { name: 'Externe' }).click();
  await page.getByPlaceholder('Description de l’anomalie').fill('plaie suspecte');

  // Directement le CTA de la modale, sans passer par « Ajouter ».
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();

  await page
    .getByRole('button', { name: /Daim N°/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Anomalies (1)' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Anomalies (1)' }).click();
  await page.getByRole('button', { name: 'Externe 1' }).click();
  await expect(page.getByRole('button', { name: 'Retirer plaie suspecte' })).toBeVisible();
});
