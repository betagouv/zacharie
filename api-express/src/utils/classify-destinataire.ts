import { EntityTypes } from '@prisma/client';
import { ALBERT_API_KEY } from '~/config';
import { albertChatCompletion } from '~/third-parties/albert';
import { capture } from '~/third-parties/sentry';

export const CLASSIFIABLE_TYPES = [
  EntityTypes.COMMERCE_DE_DETAIL,
  EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
  EntityTypes.ASSOCIATION_CARITATIVE,
  EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
  EntityTypes.COLLECTEUR_PRO,
] as const;

type ClassifiableType = (typeof CLASSIFIABLE_TYPES)[number];

const SYSTEM_PROMPT = `Tu classes les destinataires de gibier sauvage saisis par des chasseurs dans l'application Zacharie (traçabilité de la venaison).
On te donne la raison sociale du destinataire et la « qualité du destinataire » écrite librement par le chasseur.
Réponds par UN SEUL mot parmi :
- COMMERCE_DE_DETAIL : boucherie, charcuterie, restaurant, traiteur, épicerie, commerce qui vend ou cuisine la viande au client final
- CANTINE_OU_RESTAURATION_COLLECTIVE : cantine scolaire ou d'entreprise, restauration collective, EHPAD, hôpital
- ASSOCIATION_CARITATIVE : banque alimentaire, Restos du cœur, Secours populaire, association d'aide alimentaire
- REPAS_DE_CHASSE_OU_ASSOCIATIF : repas de chasse, repas d'association, comité des fêtes, fête de village
- COLLECTEUR_PRO : collecteur professionnel de gibier, transporteur ou négociant qui achète le gibier pour le livrer à un atelier de traitement
- CIRCUIT_COURT : si tu as un doute, ou si aucune catégorie ne correspond clairement
Ne réponds rien d'autre que ce mot.`;

export function parseClassification(content: string | null | undefined): ClassifiableType | 'CIRCUIT_COURT' {
  const answer = (content ?? '')
    .trim()
    .replace(/[`"'.*]/g, '')
    .toUpperCase();
  const match = CLASSIFIABLE_TYPES.find((type) => type === answer);
  return match ?? EntityTypes.CIRCUIT_COURT;
}

export async function classifyDestinataire({
  raisonSociale,
  qualiteDuDestinataire,
}: {
  raisonSociale: string;
  qualiteDuDestinataire: string;
}): Promise<ClassifiableType | 'CIRCUIT_COURT'> {
  if (!ALBERT_API_KEY) return EntityTypes.CIRCUIT_COURT;
  try {
    const { message } = await albertChatCompletion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Raison sociale : ${raisonSociale}\nQualité du destinataire : ${qualiteDuDestinataire}`,
        },
      ],
    });
    return parseClassification(message.content);
  } catch (error) {
    capture(error as Error, { extra: { raisonSociale, qualiteDuDestinataire } });
    return EntityTypes.CIRCUIT_COURT;
  }
}
