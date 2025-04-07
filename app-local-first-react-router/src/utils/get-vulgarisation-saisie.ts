import { CarcasseType } from '@prisma/client';
import lesions from '@app/data/svi/lesions.json';

export function getVulgarisationSaisie(motif: string, carcasseType: CarcasseType) {
  return lesions[carcasseType]
    .map((l) => {
      return {
        ...l,
        'MOTIVATION EN FAIT (CERTIFICAT) + CODE ZACHARIE': `${l['CODE ZACHARIE']}. ${l['MOTIVATION EN FAIT (CERTIFICAT)']}`,
      };
    })
    .find((l) => {
      if (l['MOTIVATION EN FAIT (CERTIFICAT) + CODE ZACHARIE'] === motif) return true;
      if (l['MOTIVATION EN FAIT (CERTIFICAT)'] === motif) return true;
      return false;
    })?.['VULGARISATION POUR PREMIER DÉTENTEUR ET EXAMINATEUR INITIAL'];
}
