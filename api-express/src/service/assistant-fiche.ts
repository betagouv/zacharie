import { Carcasse, CarcasseType, Fei, User } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { z } from 'zod';
import { albertChatCompletion, type AlbertTool } from '~/third-parties/albert';
import type { AlbertMessage } from '~/types/bug-investigation';
import type { AssistantFicheCarcasse, AssistantFicheData } from '~/types/responses';
import { normalizeVille, searchVilles } from '~/utils/search-ville';
import { capture } from '~/third-parties/sentry';

dayjs.extend(utc);

// Assistant de saisie d'une fiche (easter egg « zacharie ») : le chasseur tape ou dicte tout ce
// qu'il sait, Albert en extrait les données, le serveur les vérifie (espèces, dates, heures, commune,
// propriétaire initial) et le front les écrit sur la fiche. On ajoute ou on modifie, on ne supprime jamais.

export const GRAND_GIBIER = [
  'Cerf élaphe',
  'Cerf sika',
  'Chevreuil',
  'Daim',
  'Sanglier',
  'Chamois',
  'Isard',
  'Mouflon méditerranéen',
];
export const PETIT_GIBIER = [
  'Canards',
  'Faisans de chasse',
  'Perdrix',
  'Pigeons',
  'Autres oiseaux',
  'Lapins',
  'Lièvres',
  'Autres petits gibiers à poils',
];

export type AssistantChatMessage = { role: 'user' | 'assistant'; content: string };

const heureSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);

const extractionSchema = z.object({
  date_mise_a_mort: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = dayjs.utc(value);
      return (
        date.isValid() &&
        !date.isAfter(dayjs.utc().endOf('day')) &&
        !date.isBefore(dayjs.utc().add(-6, 'months'))
      );
    })
    .optional()
    .nullable()
    .catch(null),
  commune_mise_a_mort: z.string().trim().min(1).max(100).optional().nullable().catch(null),
  premier_detenteur: z.string().trim().min(1).max(200).optional().nullable().catch(null),
  heure_mise_a_mort_premiere_carcasse: heureSchema.optional().nullable().catch(null),
  heure_evisceration_derniere_carcasse: heureSchema.optional().nullable().catch(null),
  // chaque carcasse est vérifiée à part (carcasseSchema) : une carcasse invalide n'écarte pas le reste
  carcasses: z.array(z.unknown()).max(300).optional().nullable().catch(null),
});

const carcasseSchema = z.object({
  numero_bracelet: z.string().trim().min(1).max(50),
  espece: z
    .enum([...GRAND_GIBIER, ...PETIT_GIBIER] as [string, ...string[]])
    .optional()
    .nullable(),
  nombre_d_animaux: z.number().int().min(1).max(1000).optional().nullable(),
  commentaire: z.string().trim().max(500).optional().nullable(),
});

export type AssistantExtraction = Omit<z.infer<typeof extractionSchema>, 'carcasses'> & {
  carcasses: Array<z.infer<typeof carcasseSchema>>;
};

// le propriétaire initial ne peut être qu'un de ceux que le formulaire propose : on les donne en liste fermée
const remplirFicheTool = (premierDetenteurOptions: Array<string>): AlbertTool => ({
  type: 'function',
  function: {
    name: 'remplir_fiche',
    description:
      "Enregistre sur la fiche d'examen initial les données données par le chasseur. N'envoyer que les champs que le chasseur a donnés ou corrigés.",
    parameters: {
      type: 'object',
      properties: {
        date_mise_a_mort: { type: 'string', description: 'Date de la chasse, format YYYY-MM-DD' },
        commune_mise_a_mort: {
          type: 'string',
          description: 'Commune de la chasse, telle que dite par le chasseur (avec le code postal si donné)',
        },
        ...(premierDetenteurOptions.length > 0
          ? {
              premier_detenteur: {
                type: 'string',
                description: 'Propriétaire initial de la fiche, choisi dans la liste',
                enum: premierDetenteurOptions,
              },
            }
          : {}),
        heure_mise_a_mort_premiere_carcasse: {
          type: 'string',
          description: 'Heure de mise à mort de la première carcasse, format HH:mm',
        },
        heure_evisceration_derniere_carcasse: {
          type: 'string',
          description: "Heure d'éviscération de la dernière carcasse, format HH:mm",
        },
        carcasses: {
          type: 'array',
          description:
            'Carcasses (grand gibier : une par animal) ou lots (petit gibier). Une carcasse existante est identifiée par son numéro de marquage : ne renvoyer que les champs à modifier.',
          items: {
            type: 'object',
            properties: {
              numero_bracelet: { type: 'string', description: 'Numéro de marquage (bracelet, languette)' },
              espece: { type: 'string', enum: [...GRAND_GIBIER, ...PETIT_GIBIER] },
              nombre_d_animaux: {
                type: 'integer',
                description: "Nombre d'animaux du lot (petit gibier uniquement)",
              },
              commentaire: { type: 'string' },
            },
            required: ['numero_bracelet'],
          },
        },
      },
    },
  },
});

function describeFiche(fei: Fei, carcasses: Array<Carcasse>) {
  const lines = [
    `- date de la chasse : ${fei.date_mise_a_mort ? dayjs.utc(fei.date_mise_a_mort).format('YYYY-MM-DD') : 'non renseignée'}`,
    `- commune : ${fei.commune_mise_a_mort || 'non renseignée'}`,
    `- propriétaire initial : ${fei.premier_detenteur_name_cache || 'non renseigné'}`,
    `- heure de mise à mort de la première carcasse : ${fei.heure_mise_a_mort_premiere_carcasse || 'non renseignée'}`,
    `- heure d'éviscération de la dernière carcasse : ${fei.heure_evisceration_derniere_carcasse || 'non renseignée'}`,
  ];
  if (carcasses.length === 0) {
    lines.push('- carcasses : aucune');
  } else {
    lines.push('- carcasses :');
    for (const carcasse of carcasses) {
      const nombre = carcasse.type === CarcasseType.PETIT_GIBIER ? ` (${carcasse.nombre_d_animaux})` : '';
      lines.push(`  - ${carcasse.numero_bracelet} : ${carcasse.espece}${nombre}`);
    }
  }
  return lines.join('\n');
}

function systemPrompt(
  fei: Fei,
  carcasses: Array<Carcasse>,
  premierDetenteurOptions: Array<string>,
  user: User
) {
  return `Tu es Zacharie, l'assistant de saisie d'une fiche d'examen initial du gibier sauvage.
Le chasseur te donne en vrac (souvent dicté) les informations de sa chasse. Tu appelles l'outil remplir_fiche avec les données qu'il a données ou corrigées, et rien d'autre.
Aujourd'hui : ${dayjs.utc().format('YYYY-MM-DD')} (« hier », « samedi dernier » se calculent à partir de cette date).
Règles :
- n'invente jamais une donnée : un champ non dit n'est pas envoyé ;
- n'envoie que ce que le DERNIER message du chasseur apporte ou corrige : ce qui est déjà dans l'état actuel de la fiche (ci-dessous) ne se renvoie pas ;
- grand gibier (${GRAND_GIBIER.join(', ')}) : une carcasse par animal, chacune avec son propre numéro de marquage ;
- petit gibier (${PETIT_GIBIER.join(', ')}) : un lot par numéro de marquage, avec le nombre d'animaux ;
- espèces au pluriel ou au féminin (« chevrettes », « laie », « faisans ») : ramène-les à l'espèce de la liste ;
- pour modifier une carcasse existante, renvoie son numéro de marquage et les seuls champs à changer ;
- propriétaire initial : uniquement l'un de ceux-ci, quand le chasseur le nomme (même approximativement) : ${
    premierDetenteurOptions.length > 0
      ? premierDetenteurOptions.map((option) => `« ${option} »`).join(', ')
      : 'aucun'
  }. Le chasseur s'appelle ${user.prenom} ${user.nom_de_famille} : « moi » le désigne. Un nom de la liste n'est jamais une espèce ;
- tu ne supprimes rien et tu ne transmets pas la fiche ;
- si le chasseur ne donne aucune donnée de la fiche, n'appelle pas l'outil et réponds-lui en une phrase courte.
État actuel de la fiche :
${describeFiche(fei, carcasses)}`;
}

// ce que l'assistant a compris, gardé tel quel dans le log de l'échange
export type AssistantExtractionResult = {
  extraction: AssistantExtraction | null;
  text: string;
  toolArguments: string | null;
  issues: unknown;
};

export async function extractFicheData(
  messages: Array<AssistantChatMessage>,
  fei: Fei,
  carcasses: Array<Carcasse>,
  premierDetenteurOptions: Array<string>,
  user: User
): Promise<AssistantExtractionResult> {
  const tool = remplirFicheTool(premierDetenteurOptions);
  const albertMessages: Array<AlbertMessage> = [
    { role: 'system', content: systemPrompt(fei, carcasses, premierDetenteurOptions, user) },
    ...messages.map((message) => ({ role: message.role, content: message.content }) as AlbertMessage),
  ];
  const { message } = await albertChatCompletion({
    messages: albertMessages,
    tools: [tool],
    toolChoice: 'auto',
  });
  const toolCall = message.tool_calls?.find((call) => call.function.name === tool.function.name);
  if (!toolCall) {
    return {
      extraction: null,
      text: message.content || "Je n'ai trouvé aucune donnée à enregistrer.",
      toolArguments: null,
      issues: null,
    };
  }
  const toolArguments = toolCall.function.arguments || '{}';
  let args: unknown;
  try {
    args = JSON.parse(toolArguments);
  } catch {
    return {
      extraction: null,
      text: "Je n'ai pas compris, pouvez-vous reformuler ?",
      toolArguments,
      issues: 'JSON invalide',
    };
  }
  const result = extractionSchema.safeParse(args);
  if (!result.success) {
    capture(new Error('Assistant fiche : sortie Albert invalide'), {
      extra: { issues: result.error.issues, feiNumero: fei.numero },
    });
    return {
      extraction: null,
      text: "Je n'ai pas compris, pouvez-vous reformuler ?",
      toolArguments,
      issues: result.error.issues,
    };
  }
  const carcassesValides: AssistantExtraction['carcasses'] = [];
  const carcassesIssues: Array<z.ZodIssue> = [];
  for (const item of result.data.carcasses ?? []) {
    const carcasse = carcasseSchema.safeParse(item);
    if (carcasse.success) carcassesValides.push(carcasse.data);
    else carcassesIssues.push(...carcasse.error.issues);
  }
  if (carcassesIssues.length > 0) {
    capture(new Error('Assistant fiche : carcasse invalide dans la sortie Albert'), {
      extra: { issues: carcassesIssues, feiNumero: fei.numero },
    });
  }
  const extraction: AssistantExtraction = { ...result.data, carcasses: carcassesValides };
  if (extraction.premier_detenteur && !premierDetenteurOptions.includes(extraction.premier_detenteur)) {
    extraction.premier_detenteur = null;
  }
  return {
    extraction,
    text: '',
    toolArguments,
    issues: carcassesIssues.length > 0 ? carcassesIssues : null,
  };
}

const MAX_COMMUNES_PROPOSEES = 5;

// Données vérifiées par le serveur, que le front écrit sur la fiche comme le formulaire (local-first,
// mêmes fonctions, mêmes logs) : le serveur n'écrit que le log de l'échange.
export function resolveFicheData(
  extraction: AssistantExtraction
): Omit<AssistantFicheData, 'reply' | 'assistant_request_id'> {
  // une commune dite précisément (« Moulins 03000 ») ne donne qu'un résultat : le front la choisit
  // directement ; sinon il fait choisir parmi les communes trouvées
  const communeRecherchee = extraction.commune_mise_a_mort ?? null;
  const communesTrouvees = communeRecherchee ? searchVilles(communeRecherchee, MAX_COMMUNES_PROPOSEES) : [];
  const villeExacte = communeRecherchee
    ? communesTrouvees.filter((commune) =>
        normalizeVille(commune).endsWith(` ${normalizeVille(communeRecherchee)}`)
      )
    : [];

  // un même numéro de marquage dit deux fois dans le message : la dernière mention l'emporte
  const carcassesParBracelet = new Map<string, AssistantExtraction['carcasses'][number]>();
  for (const carcasse of extraction.carcasses) {
    const precedente = carcassesParBracelet.get(carcasse.numero_bracelet);
    carcassesParBracelet.set(carcasse.numero_bracelet, {
      numero_bracelet: carcasse.numero_bracelet,
      espece: carcasse.espece ?? precedente?.espece ?? null,
      nombre_d_animaux: carcasse.nombre_d_animaux ?? precedente?.nombre_d_animaux ?? null,
      commentaire: carcasse.commentaire || precedente?.commentaire || null,
    });
  }
  const carcasses: Array<AssistantFicheCarcasse> = [...carcassesParBracelet.values()].map((carcasse) => {
    const isPetitGibier = !!carcasse.espece && PETIT_GIBIER.includes(carcasse.espece);
    return {
      numero_bracelet: carcasse.numero_bracelet,
      espece: carcasse.espece ?? null,
      type: carcasse.espece ? (isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER) : null,
      // le nombre d'animaux n'a de sens que pour un lot de petit gibier
      nombre_d_animaux: carcasse.espece && !isPetitGibier ? 1 : (carcasse.nombre_d_animaux ?? null),
      commentaire: carcasse.commentaire || null,
    };
  });

  return {
    date_mise_a_mort: extraction.date_mise_a_mort ?? null,
    heure_mise_a_mort_premiere_carcasse: formatHeure(extraction.heure_mise_a_mort_premiere_carcasse),
    heure_evisceration_derniere_carcasse: formatHeure(extraction.heure_evisceration_derniere_carcasse),
    commune_recherchee: communeRecherchee,
    communes_trouvees: villeExacte.length === 1 ? villeExacte : communesTrouvees,
    premier_detenteur: extraction.premier_detenteur ?? null,
    carcasses,
  };
}

// « 8:30 » et « 08:30 » sont la même heure : on renvoie toujours HH:mm, comme le formulaire
function formatHeure(heure: string | null | undefined) {
  if (!heure) return null;
  const [heures, minutes] = heure.split(':');
  return `${heures.padStart(2, '0')}:${minutes}`;
}
