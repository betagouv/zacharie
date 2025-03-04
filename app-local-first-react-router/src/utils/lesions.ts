import { CarcasseType } from '@prisma/client';
import lesions from '@app/data/svi/lesions.json';
import { TreeNode } from '@app/components/ModalTreeDisplay';

export const lesionsList = Object.keys(lesions).reduce(
  (groupedByType, type) => {
    groupedByType[type as CarcasseType] = lesions[type as CarcasseType].map(
      (item) => `${item['CODE ZACHARIE']}. ${item['MOTIVATION EN FAIT (CERTIFICAT)']}`,
    );
    return groupedByType;
  },
  {} as Record<CarcasseType, string[]>,
);

export const lesionsTree = Object.keys(lesions).reduce(
  (groupedByType, type) => {
    groupedByType[type as CarcasseType] = lesions[type as CarcasseType].reduce((tree, item) => {
      if (!tree[item['FAMILLES DE LESIONS']]) {
        tree[item['FAMILLES DE LESIONS']] = [];
      }
      (tree[item['FAMILLES DE LESIONS']] as string[]).push(
        `${item['CODE ZACHARIE']}. ${item['MOTIVATION EN FAIT (CERTIFICAT)']}`,
      );
      return tree;
    }, {} as TreeNode);
    return groupedByType;
  },
  {} as Record<CarcasseType, TreeNode>,
);
