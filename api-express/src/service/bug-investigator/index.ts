import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { BugInvestigationStatus, Prisma } from '@prisma/client';
import prisma from '~/prisma';
import { SOURCE_COMMIT, GITHUB_REPO } from '~/config';
import { capture } from '~/third-parties/sentry';
import { albertChatCompletion, type AlbertContentPart, type AlbertMessage } from '~/third-parties/albert';
import type { BugInvestigationStep } from '~/types/bug-investigation';
import { executeInvestigatorTool, investigatorTools } from './tools';

const MAX_ITERATIONS = 40;
const MAX_DURATION_MS = 15 * 60 * 1000;
const STEP_RESULT_PREVIEW_CHARS = 3000;

function buildSystemPrompt() {
  const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
  return `Tu es l'assistant de résolution de bugs de Zacharie, application de l'État (beta.gouv.fr) de traçabilité de la venaison, de la chasse à la consommation.

# Ta mission
Un développeur ou un membre de l'équipe te décrit un dysfonctionnement (texte et/ou capture d'écran d'un ticket Notion). Tu enquêtes dans le code et dans la base de production pour comprendre ce qui s'est passé, puis tu proposes une solution.

# Règles absolues
- Tu es en LECTURE SEULE. Tu ne peux ni modifier le code, ni modifier la base. Tu ne proposes que des pistes : ce sont les développeurs qui décideront et exécuteront.
- Ne conclus jamais sans preuve. Chaque affirmation s'appuie sur un fichier:ligne lu ou sur un résultat de requête. Si tu supposes, dis-le.
- Commence par retrouver les données concernées en base (fiche, carcasse, utilisateur, logs), puis lis le code qui les a produites.
- Sois économe : requêtes ciblées avec WHERE et colonnes précises, lecture des fichiers par plages de lignes.
- Les journaux d'actions des utilisateurs sont dans la table "Log" (colonnes action, user_id, fei_numero, zacharie_carcasse_id, history, created_at...).

# Architecture (monorepo ${GITHUB_REPO}, commit déployé : ${SOURCE_COMMIT})
- api-express/ : API Express + Prisma + PostgreSQL. Contrôleurs dans src/controllers/, endpoint de synchro unique src/controllers/sync.ts, effets de bord src/utils/carcasse-side-effects.ts et src/utils/fei-side-effects.ts, crons dans src/cronjobs/.
- app-local-first-react-router/ : front React local-first. Les modifications sont d'abord enregistrées localement (IndexedDB via Zustand, src/zustand/store.ts, is_synced = false), puis synchronisées vers l'API. Un bug peut donc venir d'une donnée restée sur le téléphone d'un utilisateur hors ligne.
- expo/ : application mobile, simple WebView autour du front.
- Domaines : FEI (Fiche d'Examen Initial, table "Fei", identifiant "numero"), Carcasse (identifiant "zacharie_carcasse_id"), CarcasseIntermediaire (prise en charge par les collecteurs / ETG), rôles CHASSEUR, COLLECTEUR_PRO, ETG, SVI, COMMERCE_DE_DETAIL...
- Certains champs de la FEI sont recopiés sur chaque carcasse, côté client (src/utils/map-fei-fields-to-carcasse.ts) et côté serveur (syncCarcasseDates dans fei-side-effects.ts).

# Format du rapport final (Markdown, en français)
Quand tu as fini d'enquêter, réponds SANS appeler d'outil, avec ce rapport :
## Résumé
## Chronologie reconstituée
## Cause racine
## Preuves
(fichiers:lignes et requêtes SQL avec leurs résultats clés)
## Plan d'action proposé
(correctif du code, et le cas échéant script SQL de correction des données à faire valider et exécuter par un développeur)
## Niveau de confiance
(élevé / moyen / faible, et pourquoi)
## Ce que je n'ai pas pu vérifier

Date du jour : ${dayjs().format('YYYY-MM-DD HH:mm')}.

# Schéma Prisma de la base
\`\`\`prisma
${schema}
\`\`\``;
}

async function saveProgress(id: string, steps: Array<BugInvestigationStep>) {
  await prisma.bugInvestigation.update({
    where: { id },
    data: { steps: steps as unknown as Prisma.InputJsonValue },
  });
}

async function finish(
  id: string,
  data: { status: BugInvestigationStatus; report?: string; error?: string },
  steps: Array<BugInvestigationStep>
) {
  await prisma.bugInvestigation.update({
    where: { id },
    data: { ...data, steps: steps as unknown as Prisma.InputJsonValue },
  });
}

export async function runBugInvestigation(id: string) {
  const investigation = await prisma.bugInvestigation.findUniqueOrThrow({ where: { id } });
  const images = investigation.images as Array<string>;
  const steps: Array<BugInvestigationStep> = [];
  const startedAt = Date.now();

  const userContent: Array<AlbertContentPart> = [
    { type: 'text', text: `Description du problème :\n${investigation.description}` },
    ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
  ];
  const messages: Array<AlbertMessage> = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: userContent },
  ];

  try {
    for (let iteration = 1; ; iteration++) {
      const outOfBudget = iteration >= MAX_ITERATIONS || Date.now() - startedAt > MAX_DURATION_MS;
      if (outOfBudget) {
        messages.push({
          role: 'user',
          content:
            "Tu as atteint la limite d'étapes de l'enquête. Rédige maintenant le rapport final avec ce que tu as trouvé, en précisant ce qui reste à vérifier.",
        });
      }
      const { message } = await albertChatCompletion({
        messages,
        tools: investigatorTools,
        toolChoice: outOfBudget ? 'none' : 'auto',
      });
      messages.push(message);

      if (!message.tool_calls?.length || outOfBudget) {
        const report = message.content?.trim();
        if (!report) throw new Error("Albert n'a pas rendu de rapport");
        await finish(id, { status: BugInvestigationStatus.TERMINE, report }, steps);
        return;
      }

      if (message.content?.trim()) {
        steps.push({ type: 'message', content: message.content.trim(), at: new Date().toISOString() });
      }
      for (const toolCall of message.tool_calls) {
        const result = await executeInvestigatorTool(toolCall.function.name, toolCall.function.arguments);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        steps.push({
          type: 'tool',
          tool: toolCall.function.name,
          args: toolCall.function.arguments,
          result: result.slice(0, STEP_RESULT_PREVIEW_CHARS),
          at: new Date().toISOString(),
        });
      }
      await saveProgress(id, steps);
    }
  } catch (error) {
    capture(error as Error, { extra: { bugInvestigationId: id } });
    await finish(id, { status: BugInvestigationStatus.ERREUR, error: (error as Error).message }, steps);
  }
}
