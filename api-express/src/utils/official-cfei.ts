import prisma from '~/prisma';
import type { OfficialCfei } from '~/types/responses';
import { canonicalNumeroCfei } from '~/utils/numero-cfei';

// La liste officielle est stockée sous forme canonique ; le numéro saisi par le chasseur est gardé tel
// quel (User.numero_cfei) et ramené à la forme canonique au moment de la comparaison.
export async function findOfficialCfeisForNumerosSaisis(numerosSaisis: Array<string>) {
  const canonicals = Array.from(new Set(numerosSaisis.map(canonicalNumeroCfei)));
  const officialCfeis: Array<OfficialCfei> = canonicals.length
    ? await prisma.officialCfei.findMany({
        where: { numero_cfei: { in: canonicals } },
        select: { numero_cfei: true, nom: true, prenom: true, departement: true },
      })
    : [];
  const byNumero = new Map(officialCfeis.map((officialCfei) => [officialCfei.numero_cfei, officialCfei]));
  return (numeroSaisi: string): OfficialCfei | null => byNumero.get(canonicalNumeroCfei(numeroSaisi)) ?? null;
}
