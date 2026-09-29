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

function truncate(text: string) {
  if (text.length <= MAX_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_RESULT_CHARS)}\n… (résultat tronqué à ${MAX_RESULT_CHARS} caractères)`;
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

async function queryDb(sql: string) {
  const check = checkReadOnlySql(sql);
  if (check.error !== null) return `Refusé : ${check.error}`;
  const rows = await getReadonlyPrisma().$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
      // la sous-requête impose la limite de lignes, et PostgreSQL y refuse les CTE qui écrivent
      return tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM (${check.sql}) AS q LIMIT ${MAX_ROWS + 1}`
      );
    },
    { timeout: 15_000 }
  );
  const truncated = rows.length > MAX_ROWS;
  const json = JSON.stringify(rows.slice(0, MAX_ROWS), (_key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  );
  return `${Math.min(rows.length, MAX_ROWS)} ligne(s)${truncated ? ` (limitées à ${MAX_ROWS})` : ''}\n${json}`;
}

/* GitHub */

function checkRepoPath(path: string) {
  const cleaned = path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (cleaned.split('/').includes('..')) throw new Error('Chemin invalide');
  return cleaned.split('/').map(encodeURIComponent).join('/');
}

async function github(path: string, accept = 'application/vnd.github+json') {
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
  return `${path} (lignes ${start}-${end} sur ${lines.length})\n${numbered.join('\n')}`;
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
