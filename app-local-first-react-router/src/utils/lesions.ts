import { CarcasseType } from '@prisma/client';
import lesions from '@app/data/svi/lesions.json';
import { TreeNode } from '@app/components/ModalTreeDisplay';

export const lesionsList = Object.keys(lesions).reduce(
  (groupedByType, type) => {
    groupedByType[type as CarcasseType] = lesions[type as CarcasseType].map(
      (item) => `${item['MOTIVATION EN FAIT (CERTIFICAT)']}`
    );
    return groupedByType;
  },
  {} as Record<CarcasseType, string[]>
);

// Libellé court (vulgarisation) par motif, tous types confondus, pour les affichages condensés.
const motifShortLabelMap = Object.values(lesions)
  .flat()
  .reduce(
    (map, item) => {
      const short = item['VULGARISATION POUR PREMIER DÉTENTEUR ET EXAMINATEUR INITIAL'];
      if (short) {
        const motif = item['MOTIVATION EN FAIT (CERTIFICAT)'];
        map[motif] = short;
        map[`${item['CODE ZACHARIE']}. ${motif}`] = short;
      }
      return map;
    },
    {} as Record<string, string>
  );

export function getMotifShortLabel(motif: string): string {
  return motifShortLabelMap[motif] ?? motif;
}

export const lesionsTree = Object.keys(lesions).reduce(
  (groupedByType, type) => {
    groupedByType[type as CarcasseType] = lesions[type as CarcasseType].reduce((tree, item) => {
      if (!tree[item['FAMILLES DE LESIONS']]) {
        tree[item['FAMILLES DE LESIONS']] = [];
      }
      (tree[item['FAMILLES DE LESIONS']] as string[]).push(`${item['MOTIVATION EN FAIT (CERTIFICAT)']}`);
      return tree;
    }, {} as TreeNode);
    return groupedByType;
  },
  {} as Record<CarcasseType, TreeNode>
);
