import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ALBERT_READONLY_DATABASE_URL, GITHUB_REPO, GITHUB_TOKEN, SOURCE_COMMIT } from '~/config';
import type { AlbertTool } from '~/third-parties/albert';

// Tous les outils de l'assistant sont en lecture seule : aucun ne peut modifier le code ni la base.
// La vraie garantie côté base est le rôle PostgreSQL SELECT-only (doc/bug-resolution.md), pas ce fichier.

const MAX_ROWS = 200;
const MAX_FILE_LINES = 400;
const MAX_RESULT_CHARS = 30_000;

export const investigatorTools: Array<AlbertTool> = [
  {
    type: 'function',
    function: {
      name: 'query_db',
      description: `Exécute UNE requête SQL SELECT (ou WITH ... SELECT) en lecture seule sur la base PostgreSQL de production. Les noms de tables et de colonnes Prisma sont entre guillemets doubles, ex : SELECT "numero", "created_at" FROM "Fei" WHERE "numero" = 'ZACH-...'. Maximum ${MAX_ROWS} lignes, 10 secondes. Les tables Password, ApiKey, ApiKeyApprovalByUserOrEntity et les colonnes de tokens push ne sont pas lisibles.`,
      parameters: {
        type: 'object',
        properties: { sql: { type: 'string', description: 'La requête SELECT' } },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fei_timeline',
      description:
        "Chronologie complète d'une fiche : toutes les actions de la table Log, dans l'ordre, avec l'utilisateur, son rôle, l'entité, la carcasse et les champs modifiés (avant → après). À appeler EN PREMIER dès qu'un numéro de fiche est connu. La dernière action est signalée à la fin.",
      parameters: {
        type: 'object',
        properties: {
          fei_numero: { type: 'string', description: 'Numéro de fiche, ex : ZACH-20260925-Q4MVT-085039' },
        },
        required: ['fei_numero'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'describe_tables',
      description:
        'Renvoie la définition Prisma (colonnes, types, commentaires, relations) des tables ou enums demandés.',
      parameters: {
        type: 'object',
        properties: {
          names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Noms de modèles ou d\'enums Prisma, ex : ["Carcasse", "Log", "FeiOwnerRole"]',
          },
        },
        required: ['names'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description:
        "Recherche plein texte dans le code du dépôt GitHub (branche principale). Renvoie les fichiers et extraits correspondants. Utilise des mots-clés précis (nom de fonction, texte affiché à l'écran, nom de colonne).",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Mots-clés à rechercher' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: `Lit un fichier du dépôt, tel que déployé en production. Renvoie les lignes numérotées, ${MAX_FILE_LINES} lignes au maximum par appel.`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Chemin depuis la racine du dépôt, ex : api-express/src/controllers/sync.ts',
          },
          start_line: { type: 'integer', description: 'Première ligne (défaut 1)' },
          end_line: { type: 'integer', description: 'Dernière ligne incluse' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: "Liste le contenu d'un dossier du dépôt (chaîne vide pour la racine).",
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_commits',
      description:
        'Liste les 20 derniers commits déployés, éventuellement limités à un fichier ou un dossier. Utile pour savoir si une modification récente a pu introduire le bug.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Fichier ou dossier (optionnel)' } },
      },
    },
  },
];

export async function executeInvestigatorTool(name: string, rawArgs: string): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return `Arguments JSON invalides : ${rawArgs}`;
  }
  try {
    switch (name) {
      case 'query_db':
        return truncate(await queryDb(String(args.sql ?? '')));
      case 'describe_tables':
        return truncate(describeTables(Array.isArray(args.names) ? args.names.map(String) : []));
      case 'fei_timeline':
        return await feiTimeline(String(args.fei_numero ?? ''));
      case 'search_code':
        return truncate(await searchCode(String(args.query ?? '')));
      case 'read_file':
        return truncate(
          await readFile(String(args.path ?? ''), Number(args.start_line) || 1, Number(args.end_line) || 0)
        );
      case 'list_dir':
        return truncate(await listDir(String(args.path ?? '')));
      case 'list_commits':
        return truncate(await listCommits(args.path ? String(args.path) : ''));
      default:
        return `Outil inconnu : ${name}`;
    }
  } catch (error) {
    return `Erreur : ${(error as Error).message}`;
  }
}

// l'avertissement est en tête : un modèle qui ne lit que le début doit savoir que la fin manque
function truncate(text: string) {
  if (text.length <= MAX_RESULT_CHARS) return text;
  return `⚠️ RÉSULTAT TRONQUÉ : seuls les ${MAX_RESULT_CHARS} premiers caractères sur ${text.length} sont affichés, LA FIN MANQUE. Refais une requête plus ciblée (colonnes précises, WHERE, ORDER BY ... DESC, LIMIT) avant de conclure.\n${text.slice(0, MAX_RESULT_CHARS)}`;
}

/* SQL */

// Premier filet de sécurité avant le rôle en lecture seule : une seule instruction, SELECT ou WITH
export function checkReadOnlySql(sql: string): { sql: string; error: null } | { sql: null; error: string } {
  const cleaned = sql.trim().replace(/;\s*$/, '');
  if (!cleaned) return { sql: null, error: 'Requête vide' };
  if (cleaned.includes(';')) return { sql: null, error: 'Une seule requête à la fois (pas de ;)' };
  if (!/^(select|with)\b/i.test(cleaned)) {
    return { sql: null, error: 'Seules les requêtes SELECT sont autorisées' };
  }
  return { sql: cleaned, error: null };
}

let readonlyPrisma: PrismaClient | null = null;
function getReadonlyPrisma() {
  if (!ALBERT_READONLY_DATABASE_URL) throw new Error('ALBERT_READONLY_DATABASE_URL manquante');
  if (!readonlyPrisma) readonlyPrisma = new PrismaClient({ datasourceUrl: ALBERT_READONLY_DATABASE_URL });
  return readonlyPrisma;
}

function readonlyQuery<T>(sql: string, ...params: Array<unknown>) {
  return getReadonlyPrisma().$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
      return tx.$queryRawUnsafe<Array<T>>(sql, ...params);
    },
    { timeout: 15_000 }
  );
}

async function queryDb(sql: string) {
  const check = checkReadOnlySql(sql);
  if (check.error !== null) return `Refusé : ${check.error}`;
  // la sous-requête impose la limite de lignes, et PostgreSQL y refuse les CTE qui écrivent
  const rows = await readonlyQuery<Record<string, unknown>>(
    `SELECT * FROM (${check.sql}) AS q LIMIT ${MAX_ROWS + 1}`
  );
  const truncated = rows.length > MAX_ROWS;
  const json = JSON.stringify(rows.slice(0, MAX_ROWS), (_key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  );
  return `${Math.min(rows.length, MAX_ROWS)} ligne(s)${truncated ? ` (limitées à ${MAX_ROWS})` : ''}\n${json}`;
}

/* Schéma Prisma */

let schemaBlocks: Map<string, { kind: 'model' | 'enum'; text: string }> | null = null;
function getSchemaBlocks() {
  if (!schemaBlocks) {
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf-8');
    schemaBlocks = new Map();
    for (const match of schema.matchAll(/^(model|enum) (\w+) \{[\s\S]*?^\}/gm)) {
      schemaBlocks.set(match[2], { kind: match[1] as 'model' | 'enum', text: match[0] });
    }
  }
  return schemaBlocks;
}

export function listSchemaBlocks(kind: 'model' | 'enum') {
  return [...getSchemaBlocks()].filter(([, block]) => block.kind === kind).map(([name]) => name);
}

export function describeTables(names: Array<string>) {
  if (!names.length) return 'Aucun nom de table fourni';
  const blocks = getSchemaBlocks();
  return names
    .map((name) => blocks.get(name.replace(/"/g, '').trim())?.text ?? `${name} : table ou enum inconnu`)
    .join('\n\n');
}

/* Chronologie d'une fiche */

const IGNORED_HISTORY_FIELDS = ['updated_at', 'is_synced'];

function formatValue(value: unknown) {
  if (value === null || value === undefined) return 'null';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function summarizeHistory(history: unknown): string {
  if (!history) return '';
  let parsed: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null };
  try {
    parsed = typeof history === 'string' ? JSON.parse(history) : (history as typeof parsed);
  } catch {
    return formatValue(history);
  }
  const before = parsed.before ?? {};
  const after = parsed.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => !IGNORED_HISTORY_FIELDS.includes(key)
  );
  const changes = keys
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .map((key) =>
      parsed.before
        ? `${key}: ${formatValue(before[key])} → ${formatValue(after[key])}`
        : `${key}=${formatValue(after[key])}`
    );
  if (!changes.length) return '';
  return parsed.before ? changes.join(' ; ') : `création : ${changes.join(' ; ')}`;
}

type TimelineRow = {
  created_at: Date;
  action: string;
  user_id: string | null;
  user_role: string | null;
  user_name: string | null;
  entity_id: string | null;
  entity_name: string | null;
  zacharie_carcasse_id: string | null;
  history: unknown;
};

type ActorRow = {
  id: string;
  name: string | null;
  roles: Array<string> | null;
  etg_role: string | null;
  entities: string | null;
};

// le rôle d'un log est celui avec lequel l'utilisateur a agi (ex : un salarié d'ETG en mode transport agit
// comme COLLECTEUR_PRO) : on donne aussi son vrai compte, sinon on le prend pour une autre entreprise
async function describeActors(userIds: Array<string>) {
  if (!userIds.length) return 'Acteurs : aucun';
  const actors = await readonlyQuery<ActorRow>(
    `SELECT u."id", NULLIF(TRIM(CONCAT(u."prenom", ' ', u."nom_de_famille")), '') AS name,
       u."roles"::text[] AS roles, u."etg_role"::text AS etg_role,
       STRING_AGG(e."nom_d_usage" || ' (' || e."id" || ', ' || e."type"::text || ')', ' ; ') AS entities
     FROM "User" u
     LEFT JOIN "EntityAndUserRelations" r ON r."owner_id" = u."id" AND r."deleted_at" IS NULL
       AND r."relation" = 'CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY'
     LEFT JOIN "Entity" e ON e."id" = r."entity_id"
     WHERE u."id" = ANY($1)
     GROUP BY u."id"`,
    userIds
  );
  const lines = actors.map((actor) => {
    const roles = (actor.roles ?? []).join(', ') || 'aucun rôle';
    const etgRole =
      (actor.roles ?? []).includes('ETG') && actor.etg_role ? `, etg_role ${actor.etg_role}` : '';
    return `- ${actor.name ?? ''} (${actor.id}) : compte ${roles}${etgRole} ; travaille pour : ${actor.entities ?? 'aucune entité'}`;
  });
  return `Acteurs (compte réel de chaque utilisateur, qui peut différer du rôle avec lequel il agit) :\n${lines.join('\n')}`;
}

async function feiTimeline(feiNumero: string) {
  if (!feiNumero.trim()) return 'Numéro de fiche manquant';
  const rows = await readonlyQuery<TimelineRow>(
    `SELECT l."created_at", l."action", l."user_id", l."user_role", l."entity_id", l."zacharie_carcasse_id", l."history",
       NULLIF(TRIM(CONCAT(u."prenom", ' ', u."nom_de_famille")), '') AS user_name,
       e."nom_d_usage" AS entity_name
     FROM "Log" l
     LEFT JOIN "User" u ON u."id" = l."user_id"
     LEFT JOIN "Entity" e ON e."id" = l."entity_id"
     WHERE l."fei_numero" = $1 AND l."deleted_at" IS NULL
     ORDER BY l."created_at" ASC`,
    feiNumero.trim()
  );
  if (!rows.length) return `Aucune action journalisée pour la fiche ${feiNumero}`;
  const lines = rows.map((row, index) => {
    const who = [
      row.user_name,
      row.user_id && `(${row.user_id})`,
      row.user_role && `agit comme ${row.user_role}`,
    ]
      .filter(Boolean)
      .join(' ');
    const entity = row.entity_id ? ` pour ${row.entity_name ?? ''} (${row.entity_id})` : '';
    const carcasse = row.zacharie_carcasse_id ? ` carcasse ${row.zacharie_carcasse_id}` : '';
    const changes = summarizeHistory(row.history);
    return `${index + 1}. ${new Date(row.created_at).toISOString()} ${row.action} — ${who}${entity}${carcasse}${changes ? `\n   ${changes}` : ''}`;
  });
  const last = rows.at(-1)!;
  const footer = `\nDERNIÈRE ACTION : n°${rows.length}, ${last.action} le ${new Date(last.created_at).toISOString()}`;
  // si c'est trop long, on retire les plus anciennes : ce sont les dernières actions qui expliquent l'état actuel
  let omitted = 0;
  while (
    omitted < lines.length - 1 &&
    lines.slice(omitted).join('\n').length + footer.length > MAX_RESULT_CHARS
  ) {
    omitted++;
  }
  const actors = await describeActors([
    ...new Set(rows.map((row) => row.user_id).filter(Boolean) as Array<string>),
  ]);
  const header = `${actors}\n\n${rows.length} action(s) pour la fiche ${feiNumero}, de la plus ancienne à la plus récente.${
    omitted
      ? ` ⚠️ Les ${omitted} plus anciennes sont omises (trop longues) : utilise query_db sur "Log" pour les voir.`
      : ''
  }`;
  return [header, ...lines.slice(omitted)].join('\n') + footer;
}

/* GitHub */

function checkRepoPath(path: string) {
  const cleaned = path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (cleaned.split('/').includes('..')) throw new Error('Chemin invalide');
  return cleaned.split('/').map(encodeURIComponent).join('/');
}

async function github(path: string, accept = 'application/vnd.github+json') {
  if (!GITHUB_TOKEN && path.startsWith('/search/')) {
    throw new Error(
      'GITHUB_TOKEN manquant : la recherche de code est indisponible. Utilise list_dir et read_file.'
    );
  }
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} : ${(await response.text()).slice(0, 300)}`);
  return response;
}

async function searchCode(query: string) {
  if (!query.trim()) return 'Requête vide';
  const q = encodeURIComponent(`${query} repo:${GITHUB_REPO}`);
  const response = await github(`/search/code?q=${q}&per_page=20`, 'application/vnd.github.text-match+json');
  const json = (await response.json()) as {
    total_count: number;
    items: Array<{ path: string; text_matches?: Array<{ fragment: string }> }>;
  };
  if (!json.items.length) return 'Aucun résultat';
  const lines = json.items.map((item) => {
    const fragments = (item.text_matches ?? []).map((m) => `    ${m.fragment.replace(/\n/g, '\n    ')}`);
    return [`- ${item.path}`, ...fragments].join('\n');
  });
  return `${json.total_count} résultat(s), ${json.items.length} affichés\n${lines.join('\n')}`;
}

async function readFile(path: string, startLine: number, endLine: number) {
  const repoPath = checkRepoPath(path);
  const response = await github(
    `/repos/${GITHUB_REPO}/contents/${repoPath}?ref=${SOURCE_COMMIT}`,
    'application/vnd.github.raw+json'
  );
  const lines = (await response.text()).split('\n');
  const start = Math.max(1, startLine);
  const end = Math.min(lines.length, endLine > 0 ? endLine : lines.length, start + MAX_FILE_LINES - 1);
  const numbered = lines.slice(start - 1, end).map((line, index) => `${start + index}\t${line}`);
  const next = end < lines.length ? `\n… suite du fichier : read_file avec start_line=${end + 1}` : '';
  return `${path} (lignes ${start}-${end} sur ${lines.length})\n${numbered.join('\n')}${next}`;
}

async function listDir(path: string) {
  const repoPath = checkRepoPath(path);
  const response = await github(`/repos/${GITHUB_REPO}/contents/${repoPath}?ref=${SOURCE_COMMIT}`);
  const json = (await response.json()) as Array<{ name: string; type: string }> | { type: string };
  if (!Array.isArray(json)) return `${path} est un fichier, utilise read_file`;
  return json.map((entry) => `${entry.type === 'dir' ? '[dossier]' : '[fichier]'} ${entry.name}`).join('\n');
}

async function listCommits(path: string) {
  const pathQuery = path ? `&path=${checkRepoPath(path)}` : '';
  const response = await github(`/repos/${GITHUB_REPO}/commits?sha=${SOURCE_COMMIT}&per_page=20${pathQuery}`);
  const json = (await response.json()) as Array<{
    sha: string;
    commit: { message: string; author: { date: string } };
  }>;
  if (!json.length) return 'Aucun commit';
  return json
    .map((c) => `${c.sha.slice(0, 8)} ${c.commit.author.date} ${c.commit.message.split('\n')[0]}`)
    .join('\n');
}
