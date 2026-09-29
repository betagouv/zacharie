import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { BugInvestigationStatus, Prisma } from '@prisma/client';
import prisma from '~/prisma';
import { SOURCE_COMMIT, GITHUB_REPO, ALBERT_VISION_MODEL } from '~/config';
import { capture } from '~/third-parties/sentry';
import { albertChatCompletion } from '~/third-parties/albert';
import type { AlbertMessage, BugInvestigationMessage } from '~/types/bug-investigation';
import { executeInvestigatorTool, investigatorTools } from './tools';

const MAX_ITERATIONS = 40;
const MAX_DURATION_MS = 15 * 60 * 1000;
// les résultats d'outils des tours précédents sont raccourcis avant l'envoi, pour rester dans le contexte du modèle
const PREVIOUS_TURNS_TOOL_RESULT_CHARS = 1500;

function readLocalFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

function buildSystemPrompt() {
  return `Tu es l'enquêteur de bugs de Zacharie, application de l'État (beta.gouv.fr) de traçabilité de la venaison, de la chasse à la consommation.

# Ta mission
Un membre de l'équipe te décrit un dysfonctionnement (texte, URL, captures d'écran d'un ticket Notion ou de l'application). Tu enquêtes dans la base de production et dans le code pour établir ce qui s'est passé, avec des preuves, puis tu proposes une solution.
C'est une conversation : après ta réponse, la personne peut te corriger, te poser une question ou t'apporter une information.

# Règles absolues
- Tu es en LECTURE SEULE. Tu ne modifies ni le code ni la base. Tu proposes, les développeurs décident et exécutent.
- Chaque affirmation s'appuie sur un résultat de requête ou sur un fichier:ligne que tu as lu. Si tu supposes, écris « hypothèse non vérifiée ».
- N'invente jamais d'intention ou d'histoire (« le développeur a probablement oublié… »). Décris des faits.
- Pas d'excuses, pas de compliments, pas de « tu as raison ». Si on te corrige, vérifie avec les outils puis réponds sur le fond. Si la correction contredit tes preuves, dis-le.
- Si un résultat d'outil est TRONQUÉ, ne conclus pas : refais une requête plus ciblée.

# Méthode d'enquête (dans cet ordre)
1. Symptômes : liste chaque symptôme décrit, pour chaque acteur concerné (ex : « visible chez l'ETG dans À compléter », « la fiche affiche Aucune action à effectuer », « le chasseur voit En cours »). Relève les identifiants : numéro de fiche (ZACH-…), identifiants d'entité ou d'utilisateur dans l'URL, numéros de bracelet.
2. Chronologie : appelle fei_timeline sur la fiche. Identifie la DERNIÈRE action, qui l'a faite, avec quel rôle, et ce qu'elle a changé. C'est presque toujours elle qui explique l'état actuel.
3. État actuel : lis la fiche ("Fei"), ses carcasses ("Carcasse"), et les prises en charge ("CarcasseIntermediaire"), avec les colonnes utiles (current_owner_*, next_owner_*, statuts, dates). Lis les utilisateurs et entités concernés (rôles, relations).
4. Code : cherche dans le code le nom de la dernière action (search_code) et lis le composant qui l'effectue, puis le composant qui affiche l'écran décrit (l'URL donne la route, voir les fichiers *-router.tsx). Lis les lignes qui décident de ce qui est affiché.
5. Hypothèse : elle doit expliquer TOUS les symptômes de l'étape 1, chacun avec une preuve. Si un symptôme n'est pas expliqué, continue l'enquête.
6. Réponse.

# Format de la première réponse (Markdown, en français)
Quand tu as fini d'enquêter, réponds SANS appeler d'outil :
## Résumé
(3 phrases maximum)
## Chronologie
(les actions de fei_timeline qui comptent, datées, avec l'acteur)
## Cause racine
(chaque symptôme → son explication → sa preuve)
## Plan d'action proposé
(correctif du code avec fichiers:lignes ; le cas échéant script SQL de correction des données, à faire valider et exécuter par un développeur)
## Niveau de confiance
(élevé / moyen / faible, et pourquoi)
## Non vérifié
Pour les messages suivants, réponds directement à la question, sans reprendre ce format, sauf si ta conclusion change.

# Architecture (monorepo ${GITHUB_REPO}, commit déployé : ${SOURCE_COMMIT})
- api-express/ : API Express + Prisma + PostgreSQL. Contrôleurs dans src/controllers/, endpoint de synchro unique src/controllers/sync.ts, effets de bord src/utils/carcasse-side-effects.ts et src/utils/fei-side-effects.ts, crons dans src/cronjobs/.
- app-local-first-react-router/ : front React local-first. Les modifications sont d'abord enregistrées sur l'appareil (IndexedDB via Zustand, src/zustand/store.ts, is_synced = false), puis synchronisées vers l'API. Une donnée peut donc manquer en base parce qu'elle est restée sur un appareil hors ligne. Les routes sont dans src/routes/<rôle>/, déclarées dans les fichiers *-router.tsx.
- expo/ : application mobile, simple WebView autour du front.

# Guide métier
${readLocalFile('src/service/bug-investigator/metier.md')}

Date du jour : ${dayjs().format('YYYY-MM-DD HH:mm')}.

# Schéma Prisma de la base
\`\`\`prisma
${readLocalFile('prisma/schema.prisma')}
\`\`\``;
}

// Le modèle d'enquête ne lit pas les images : le modèle de vision décrit une fois chaque nouvelle capture,
// la description est gardée dans le message
async function describeNewImages(messages: Array<BugInvestigationMessage>) {
  let changed = false;
  for (const message of messages) {
    if (message.role !== 'user' || typeof message.content === 'string' || message.image_descriptions)
      continue;
    const images = message.content.filter((part) => part.type === 'image_url');
    if (!images.length) continue;
    const userText = message.content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('\n')
      .trim();
    message.image_descriptions = [];
    for (const image of images) {
      const { message: description } = await albertChatCompletion({
        model: ALBERT_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Cette capture d'écran accompagne un signalement de bug sur Zacharie (application de traçabilité du gibier) : « ${userText || 'pas de texte'} ».
Transcris INTÉGRALEMENT et fidèlement tout le texte visible : titres, onglets, libellés, boutons, statuts, badges, numéros de fiche ou de bracelet, noms, dates, URL, messages d'erreur, commentaires d'un ticket. Indique ensuite en quelques lignes la structure de l'écran (quel onglet ou élément est sélectionné, ce qui est mis en évidence). N'interprète pas, ne propose pas de cause.`,
              },
              image,
            ],
          },
        ],
      });
      message.image_descriptions.push(description.content?.trim() || '(capture illisible)');
    }
    changed = true;
  }
  return changed;
}

function toAlbertMessage(message: BugInvestigationMessage): AlbertMessage {
  if (message.role !== 'user') return message;
  if (typeof message.content === 'string') return { role: 'user', content: message.content };
  const text = message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
  const descriptions = (message.image_descriptions ?? []).map(
    (description, index) =>
      `[Capture d'écran ${index + 1}, transcrite par un modèle de vision]\n${description}`
  );
  return { role: 'user', content: [text, ...descriptions].filter(Boolean).join('\n\n') };
}

function toJson(messages: Array<BugInvestigationMessage>) {
  return messages as unknown as Prisma.InputJsonValue;
}

function shortenPreviousTurns(messages: Array<BugInvestigationMessage>, currentTurnStart: number) {
  return messages.map((message, index): AlbertMessage => {
    if (message.role === 'user') return toAlbertMessage(message);
    if (index >= currentTurnStart || message.role !== 'tool') return message;
    if (message.content.length <= PREVIOUS_TURNS_TOOL_RESULT_CHARS) return message;
    return {
      ...message,
      content: `${message.content.slice(0, PREVIOUS_TURNS_TOOL_RESULT_CHARS)}\n… (tronqué)`,
    };
  });
}

// Répond au dernier message de l'utilisateur : Albert appelle des outils jusqu'à pouvoir répondre sans outil
export async function runBugInvestigation(id: string) {
  const investigation = await prisma.bugInvestigation.findUniqueOrThrow({ where: { id } });
  const messages = investigation.messages as unknown as Array<BugInvestigationMessage>;
  const currentTurnStart = messages.length - 1;
  const startedAt = Date.now();

  try {
    const systemPrompt = buildSystemPrompt();
    if (await describeNewImages(messages)) {
      await prisma.bugInvestigation.update({ where: { id }, data: { messages: toJson(messages) } });
    }
    for (let iteration = 1; ; iteration++) {
      const outOfBudget = iteration >= MAX_ITERATIONS || Date.now() - startedAt > MAX_DURATION_MS;
      const request: Array<AlbertMessage> = [
        { role: 'system', content: systemPrompt },
        ...shortenPreviousTurns(messages, currentTurnStart),
      ];
      if (outOfBudget) {
        request.push({
          role: 'user',
          content:
            "Tu as atteint la limite d'étapes pour ce message. Réponds maintenant avec ce que tu as trouvé, en précisant ce qui reste à vérifier.",
        });
      }
      const { message } = await albertChatCompletion({
        messages: request,
        tools: investigatorTools,
        toolChoice: outOfBudget ? 'none' : 'auto',
      });

      if (!message.tool_calls?.length || outOfBudget) {
        const answer = message.content?.trim();
        if (!answer) throw new Error("Albert n'a pas rendu de réponse");
        messages.push({ role: 'assistant', content: answer });
        await prisma.bugInvestigation.update({
          where: { id },
          data: { status: BugInvestigationStatus.TERMINE, messages: toJson(messages) },
        });
        return;
      }

      messages.push(message);
      for (const toolCall of message.tool_calls) {
        const result = await executeInvestigatorTool(toolCall.function.name, toolCall.function.arguments);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
      }
      await prisma.bugInvestigation.update({ where: { id }, data: { messages: toJson(messages) } });
    }
  } catch (error) {
    capture(error as Error, { extra: { bugInvestigationId: id } });
    await prisma.bugInvestigation.update({
      where: { id },
      data: {
        status: BugInvestigationStatus.ERREUR,
        error: (error as Error).message,
        messages: toJson(messages),
      },
    });
  }
}
