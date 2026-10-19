import {
  Carcasse,
  CarcasseStatus,
  CarcasseType,
  Fei,
  FeiOwnerRole,
  Prisma,
  User,
  UserRoles,
} from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { z } from 'zod';
import prisma from '~/prisma';
import { albertChatCompletion, type AlbertTool } from '~/third-parties/albert';
import type { AlbertMessage } from '~/types/bug-investigation';
import { syncFei } from '~/utils/sync-fei';
import { syncCarcasse, type SaveCarcasseResult } from '~/utils/sync-carcasse';
import { createSyncScope } from '~/utils/sync-scope';
import { runFeiUpdateSideEffects } from '~/utils/fei-side-effects';
import { runCarcasseUpdateSideEffects } from '~/utils/carcasse-side-effects';
import { capture } from '~/third-parties/sentry';

dayjs.extend(utc);

// Assistant de saisie d'une fiche (easter egg « zacharie ») : le chasseur tape ou dicte tout ce
// qu'il sait, Albert en extrait les données, et on les écrit par les mêmes fonctions que /sync
// (droits, versions, effets de bord). On ajoute ou on modifie, on ne supprime jamais.

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
  carcasses: z
    .array(
      z.object({
        numero_bracelet: z.string().trim().min(1).max(50),
        espece: z
          .enum([...GRAND_GIBIER, ...PETIT_GIBIER] as [string, ...string[]])
          .optional()
          .nullable(),
        nombre_d_animaux: z.number().int().min(1).max(1000).optional().nullable(),
        commentaire: z.string().trim().max(500).optional().nullable(),
      })
    )
    .max(300)
    .optional()
    .nullable(),
});

export type AssistantExtraction = z.infer<typeof extractionSchema>;

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
  const extraction = result.data;
  if (extraction.premier_detenteur && !premierDetenteurOptions.includes(extraction.premier_detenteur)) {
    extraction.premier_detenteur = null;
  }
  return { extraction, text: '', toolArguments, issues: null };
}

export type AssistantApplyResult = {
  fei: Fei;
  carcasses: Array<Carcasse>;
  // commune telle que dite : le front la ramène au référentiel des communes et la fait choisir
  commune_recherchee: string | null;
  // choisi par le front comme au clic sur le formulaire (transmission des carcasses, log)
  premier_detenteur_choisi: string | null;
  lignes: Array<string>;
};

export async function applyFicheData(
  extraction: AssistantExtraction,
  existingFei: Fei,
  existingCarcasses: Array<Carcasse>,
  user: User,
  // relie chaque écriture au log de l'échange qui l'a déclenchée (examinateur-assistant-message)
  requestId: string
): Promise<AssistantApplyResult> {
  const scope = await createSyncScope(user);
  const lignes: Array<string> = [];

  // created_by_user_id n'est écrit qu'à la création de la fiche, qui existe déjà ici
  const feiBody = {
    numero: existingFei.numero,
    version: existingFei.version,
  } as Prisma.FeiUncheckedCreateInput;
  let feiChanged = false;
  // Albert relit tout l'échange et renvoie souvent ce qui est déjà enregistré : on n'écrit que ce qui change
  const isNewDate =
    !!extraction.date_mise_a_mort &&
    (!existingFei.date_mise_a_mort ||
      dayjs.utc(existingFei.date_mise_a_mort).format('YYYY-MM-DD') !== extraction.date_mise_a_mort);
  const heureMiseAMort = formatHeure(extraction.heure_mise_a_mort_premiere_carcasse);
  const heureEvisceration = formatHeure(extraction.heure_evisceration_derniere_carcasse);
  if (isNewDate) {
    feiBody.date_mise_a_mort = dayjs.utc(extraction.date_mise_a_mort).startOf('day').toISOString();
    lignes.push(`Date de la chasse : ${dayjs.utc(extraction.date_mise_a_mort).format('DD/MM/YYYY')}`);
    feiChanged = true;
  }
  if (heureMiseAMort && heureMiseAMort !== existingFei.heure_mise_a_mort_premiere_carcasse) {
    feiBody.heure_mise_a_mort_premiere_carcasse = heureMiseAMort;
    lignes.push(`Heure de mise à mort de la première carcasse : ${heureMiseAMort}`);
    feiChanged = true;
  }
  if (heureEvisceration && heureEvisceration !== existingFei.heure_evisceration_derniere_carcasse) {
    feiBody.heure_evisceration_derniere_carcasse = heureEvisceration;
    lignes.push(`Heure d'éviscération de la dernière carcasse : ${heureEvisceration}`);
    feiChanged = true;
  }

  let savedFei = existingFei;
  const logs: Array<Prisma.LogCreateManyInput> = [];
  if (feiChanged) {
    const { savedFei: fei } = await syncFei(existingFei.numero, feiBody, user, scope);
    savedFei = fei;
    const { numero: _numero, version: _version, ...diff } = feiBody;
    logs.push({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: existingFei.numero,
      action: 'examinateur-assistant-update-fei',
      history: historyInput(existingFei, diff, requestId),
      date: new Date(),
    });
  }

  const carcasseResults: Array<SaveCarcasseResult> = [];
  for (const item of extraction.carcasses ?? []) {
    const existingCarcasse = existingCarcasses.find((c) => c.numero_bracelet === item.numero_bracelet);
    const espece = item.espece ?? existingCarcasse?.espece ?? null;
    if (!espece) {
      lignes.push(`⚠️ Carcasse ${item.numero_bracelet} non ajoutée : espèce manquante`);
      continue;
    }
    const isPetitGibier = PETIT_GIBIER.includes(espece);
    if (existingCarcasse) {
      const nombre = isPetitGibier ? (item.nombre_d_animaux ?? existingCarcasse.nombre_d_animaux) : 1;
      const isUnchanged =
        espece === existingCarcasse.espece &&
        nombre === existingCarcasse.nombre_d_animaux &&
        (!item.commentaire || item.commentaire === existingCarcasse.examinateur_commentaire);
      if (isUnchanged) continue;
    }
    const carcasseBody: Prisma.CarcasseUncheckedCreateInput = existingCarcasse
      ? {
          zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
          fei_numero: existingFei.numero,
          numero_bracelet: existingCarcasse.numero_bracelet,
          version: existingCarcasse.version,
        }
      : {
          zacharie_carcasse_id: `${existingFei.numero}_${item.numero_bracelet}`,
          fei_numero: existingFei.numero,
          numero_bracelet: item.numero_bracelet,
          date_mise_a_mort: savedFei.date_mise_a_mort,
          heure_mise_a_mort_premiere_carcasse_fei: savedFei.heure_mise_a_mort_premiere_carcasse,
          heure_evisceration_derniere_carcasse_fei: savedFei.heure_evisceration_derniere_carcasse,
          examinateur_initial_user_id: user.id,
          examinateur_initial_offline: false,
          examinateur_anomalies_carcasse: [],
          examinateur_anomalies_abats: [],
          examinateur_signed_at: new Date(),
          svi_carcasse_status: CarcasseStatus.SANS_DECISION,
          current_owner_user_id: user.id,
          current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
          current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
          created_at: new Date(),
        };
    if (item.espece || !existingCarcasse) {
      carcasseBody.espece = espece;
      carcasseBody.type = isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER;
    }
    if (!existingCarcasse || item.espece || item.nombre_d_animaux) {
      carcasseBody.nombre_d_animaux = isPetitGibier
        ? (item.nombre_d_animaux ?? existingCarcasse?.nombre_d_animaux ?? 1)
        : 1;
    }
    if (item.commentaire) {
      carcasseBody.examinateur_commentaire = item.commentaire;
    }
    const result = await syncCarcasse(
      existingFei.numero,
      carcasseBody.zacharie_carcasse_id,
      carcasseBody,
      user,
      scope,
      { existingFei: savedFei, existingCarcasse: existingCarcasse ?? null }
    );
    carcasseResults.push(result);
    const { zacharie_carcasse_id: _id, fei_numero: _fei, version: _v, ...diff } = carcasseBody;
    logs.push({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: existingFei.numero,
      zacharie_carcasse_id: carcasseBody.zacharie_carcasse_id,
      action: existingCarcasse
        ? 'examinateur-assistant-carcasse-edit'
        : 'examinateur-assistant-carcasse-create',
      history: historyInput(existingCarcasse ?? null, diff, requestId),
      date: new Date(),
    });
    const nombre = isPetitGibier
      ? ` — ${carcasseBody.nombre_d_animaux ?? existingCarcasse?.nombre_d_animaux} animaux`
      : '';
    lignes.push(
      `${existingCarcasse ? 'Carcasse modifiée' : 'Carcasse ajoutée'} : ${item.numero_bracelet} — ${espece}${nombre}`
    );
  }

  if (logs.length > 0) {
    await prisma.log.createMany({ data: logs });
  }

  // effets de bord après toutes les écritures, comme /sync
  for (const result of carcasseResults) {
    try {
      await runCarcasseUpdateSideEffects(result.existingCarcasse, result.savedCarcasse, user);
    } catch (error) {
      capture(error as Error, { extra: { context: 'assistant_carcasse_side_effects' }, user });
    }
  }
  if (feiChanged) {
    try {
      await runFeiUpdateSideEffects(existingFei, savedFei, user);
    } catch (error) {
      capture(error as Error, { extra: { context: 'assistant_fei_side_effects' }, user });
    }
  }

  const carcasses = await prisma.carcasse.findMany({
    where: { fei_numero: existingFei.numero, deleted_at: null },
    orderBy: { created_at: 'asc' },
  });
  const fei = (await prisma.fei.findUnique({ where: { numero: existingFei.numero } })) ?? savedFei;

  return {
    fei,
    carcasses,
    commune_recherchee: extraction.commune_mise_a_mort ?? null,
    premier_detenteur_choisi: extraction.premier_detenteur ?? null,
    lignes,
  };
}

function historyInput(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  requestId: string
) {
  return {
    before: before ? Object.fromEntries(Object.keys(after).map((key) => [key, before[key]])) : null,
    after,
    assistant_request_id: requestId,
  } as Prisma.InputJsonValue;
}

// « 8:30 » et « 08:30 » sont la même heure : on enregistre toujours HH:mm, comme le formulaire
function formatHeure(heure: string | null | undefined) {
  if (!heure) return null;
  const [heures, minutes] = heure.split(':');
  return `${heures.padStart(2, '0')}:${minutes}`;
}
