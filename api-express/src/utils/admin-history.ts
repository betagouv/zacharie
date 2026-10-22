import { Prisma } from '@prisma/client';
import prisma from '~/prisma';
import type {
  AdminHistoryChange,
  AdminHistoryEvent,
  AdminHistoryLinkType,
  AdminHistorySubjectType,
} from '~/types/admin-history';

// Lecture des tables <Table>History (migration history_tables) : chaque ligne d'historique est une version
// précédente d'une ligne, valable pendant sys_period. La version courante reste dans la table elle-même.
// Un changement = une version comparée à la suivante (ou à la ligne courante), daté de la fin de sa période,
// et fait par le version_user_id de la version suivante (Fei, Carcasse et CarcasseIntermediaire seulement).

type HistorySource = {
  table: string;
  historyTable: string;
  keyColumns: Array<string>;
  hasAuthor: boolean;
};

export const HISTORY_SOURCES: Record<AdminHistorySubjectType, HistorySource> = {
  fei: { table: 'Fei', historyTable: 'FeiHistory', keyColumns: ['numero'], hasAuthor: true },
  carcasse: {
    table: 'Carcasse',
    historyTable: 'CarcasseHistory',
    keyColumns: ['zacharie_carcasse_id'],
    hasAuthor: true,
  },
  carcasse_intermediaire: {
    table: 'CarcasseIntermediaire',
    historyTable: 'CarcasseIntermediaireHistory',
    keyColumns: ['fei_numero', 'zacharie_carcasse_id', 'intermediaire_id'],
    hasAuthor: true,
  },
  user: { table: 'User', historyTable: 'UserHistory', keyColumns: ['id'], hasAuthor: false },
  entity: { table: 'Entity', historyTable: 'EntityHistory', keyColumns: ['id'], hasAuthor: false },
  user_entity: {
    table: 'EntityAndUserRelations',
    historyTable: 'EntityAndUserRelationsHistory',
    keyColumns: ['id'],
    hasAuthor: false,
  },
};

// Au-delà, la chronologie d'une fiche (jusqu'à plusieurs centaines de carcasses) est coupée aux plus récents
export const TIMELINE_MAX_EVENTS = 1000;

// Champs techniques ou secrets, jamais affichés
const IGNORED_FIELDS = [
  'updated_at',
  'is_synced',
  'version',
  'version_user_id',
  'web_push_tokens',
  'native_push_tokens',
  'history_id',
  'history_op',
];

type JsonRow = Record<string, unknown>;

// Événement avant résolution des libellés : `row` sert à nommer la ligne concernée, sans être renvoyé au front
type RawEvent = Omit<AdminHistoryEvent, 'subject' | 'author_email'> & {
  subject: { type: AdminHistorySubjectType; id: string; row: JsonRow | null };
};

export type HistoryVersion = {
  history_id: string;
  history_op: string;
  valid_to: Date;
  row: JsonRow;
};

// to_jsonb écrit les timestamp(3) sans fuseau ; Prisma les enregistre en UTC
const TIMESTAMP_SANS_FUSEAU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string' && TIMESTAMP_SANS_FUSEAU.test(value)) return `${value}Z`;
  return value ?? null;
}

export function diffRows(before: JsonRow, after: JsonRow): Array<AdminHistoryChange> {
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (field) => !IGNORED_FIELDS.includes(field)
  );
  return fields
    .filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
    .sort()
    .map((field) => ({ field, before: normalizeValue(before[field]), after: normalizeValue(after[field]) }));
}

function rowKey(source: HistorySource, row: JsonRow) {
  return source.keyColumns.map((column) => String(row[column])).join('|');
}

// Changements d'une ligne, à partir de ses versions précédentes (dans l'ordre) et de sa ligne courante
// (absente si la ligne a été supprimée pour de bon)
export function buildChanges(
  type: AdminHistorySubjectType,
  versions: Array<HistoryVersion>,
  current: JsonRow | null
): Array<RawEvent> {
  const source = HISTORY_SOURCES[type];
  return versions.flatMap((version, index): Array<RawEvent> => {
    const next = versions[index + 1]?.row ?? current;
    const base = {
      id: `${type}:${version.history_id}`,
      date: version.valid_to.toISOString(),
      subject: { type, id: rowKey(source, version.row), row: version.row },
      details: null as unknown,
    };
    if (version.history_op === 'DELETE' || !next) {
      return [
        { ...base, kind: 'suppression', title: 'Suppression définitive', author_id: null, changes: [] },
      ];
    }
    const changes = diffRows(version.row, next);
    if (!changes.length) return [];
    const author_id = source.hasAuthor ? ((next.version_user_id as string | null) ?? null) : null;
    return [{ ...base, kind: 'modification', title: 'Modification', author_id, changes }];
  });
}

function whereSql(where: Record<string, string | Array<string>>) {
  const conditions = Object.entries(where).map(([column, value]) =>
    Array.isArray(value)
      ? Prisma.sql`t.${Prisma.raw(`"${column}"`)} = ANY(${value})`
      : Prisma.sql`t.${Prisma.raw(`"${column}"`)} = ${value}`
  );
  return conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
}

// Toutes les versions des lignes qui vérifient `where` (colonnes de la table), puis leurs changements
async function loadHistoryChanges(
  type: AdminHistorySubjectType,
  where: Record<string, string | Array<string>>
): Promise<Array<RawEvent>> {
  const source = HISTORY_SOURCES[type];
  const [versions, currents] = await Promise.all([
    prisma.$queryRaw<Array<{ history_id: bigint; history_op: string; valid_to: Date; row: JsonRow }>>`
      SELECT t."history_id", t."history_op", upper(t."sys_period") AS valid_to, to_jsonb(t) - 'sys_period' AS row
      FROM ${Prisma.raw(`"${source.historyTable}"`)} t
      WHERE ${whereSql(where)}
      ORDER BY upper(t."sys_period") ASC, t."history_id" ASC`,
    prisma.$queryRaw<Array<{ row: JsonRow }>>`
      SELECT to_jsonb(t) AS row FROM ${Prisma.raw(`"${source.table}"`)} t WHERE ${whereSql(where)}`,
  ]);
  const currentByKey = new Map(currents.map(({ row }) => [rowKey(source, row), row]));
  const versionsByKey = new Map<string, Array<HistoryVersion>>();
  for (const version of versions) {
    const key = rowKey(source, version.row);
    const list = versionsByKey.get(key) ?? [];
    list.push({ ...version, history_id: String(version.history_id) });
    versionsByKey.set(key, list);
  }
  return [...versionsByKey.entries()].flatMap(([key, list]) =>
    buildChanges(type, list, currentByKey.get(key) ?? null)
  );
}

// Log.history est un JSON { before, after } enregistré tel quel par le client (parfois en chaîne)
function logChanges(history: unknown): Array<AdminHistoryChange> {
  let parsed: unknown = history;
  if (typeof history === 'string') {
    try {
      parsed = JSON.parse(history);
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const { before, after } = parsed as { before?: JsonRow | null; after?: JsonRow | null };
  return diffRows(before ?? {}, after ?? {});
}

async function loadLogs(where: Prisma.LogWhereInput): Promise<Array<RawEvent>> {
  const logs = await prisma.log.findMany({
    where: { ...where, deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: TIMELINE_MAX_EVENTS,
  });
  return logs.map((log) => ({
    id: `log:${log.id}`,
    date: log.created_at.toISOString(),
    kind: 'action',
    title: log.action,
    author_id: log.user_id,
    subject: log.zacharie_carcasse_id
      ? { type: 'carcasse', id: log.zacharie_carcasse_id, row: null }
      : log.fei_numero
        ? { type: 'fei', id: log.fei_numero, row: null }
        : { type: 'user', id: log.user_id ?? '', row: null },
    changes: logChanges(log.history),
    details: { user_role: log.user_role, entity_id: log.entity_id },
  }));
}

async function loadAdminAuditLogs(where: Prisma.AdminAuditLogWhereInput): Promise<Array<RawEvent>> {
  const logs = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: TIMELINE_MAX_EVENTS,
  });
  return logs.map((log) => ({
    id: `admin:${log.id}`,
    date: log.created_at.toISOString(),
    kind: 'admin',
    title: log.action,
    author_id: log.admin_user_id,
    subject: {
      type: (log.target_type as AdminHistorySubjectType | null) ?? 'user',
      id: log.target_id ?? '',
      row: null,
    },
    changes: diffRows((log.before as JsonRow | null) ?? {}, (log.after as JsonRow | null) ?? {}),
    details: { status_code: log.status_code, body: log.body },
  }));
}

async function loadNotifications(userId: string): Promise<Array<RawEvent>> {
  const notifications = await prisma.notificationLog.findMany({
    where: { user_id: userId, deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: TIMELINE_MAX_EVENTS,
    select: { id: true, type: true, action: true, payload: true, created_at: true },
  });
  return notifications.map((notification) => ({
    id: `notification:${notification.id}`,
    date: notification.created_at.toISOString(),
    kind: 'notification',
    title: `${notification.type} · ${notification.action}`,
    author_id: null,
    subject: { type: 'user', id: userId, row: null },
    changes: [],
    details: { payload: notification.payload },
  }));
}

export type AdminHistoryTimelineType = 'fei' | 'carcasse' | 'user' | 'entity';

// Chronologie d'une fiche (avec toutes ses carcasses et lignes intermédiaires), d'une carcasse, d'un
// utilisateur ou d'une entité : versions des tables d'historique, actions métier (Log), notifications et
// actions admin, de la plus récente à la plus ancienne
export async function loadTimeline(type: AdminHistoryTimelineType, id: string) {
  let sources: Array<Promise<Array<RawEvent>>> = [];
  if (type === 'fei') {
    const carcasses = await prisma.carcasse.findMany({
      where: { fei_numero: id },
      select: { zacharie_carcasse_id: true },
    });
    const carcasseIds = carcasses.map((carcasse) => carcasse.zacharie_carcasse_id);
    sources = [
      loadHistoryChanges('fei', { numero: id }),
      loadHistoryChanges('carcasse', { fei_numero: id }),
      loadHistoryChanges('carcasse_intermediaire', { fei_numero: id }),
      loadLogs({ fei_numero: id }),
      loadAdminAuditLogs({
        OR: [
          { target_type: 'fei', target_id: id },
          { target_type: 'carcasse', target_id: { in: carcasseIds } },
        ],
      }),
    ];
  } else if (type === 'carcasse') {
    sources = [
      loadHistoryChanges('carcasse', { zacharie_carcasse_id: id }),
      loadHistoryChanges('carcasse_intermediaire', { zacharie_carcasse_id: id }),
      loadLogs({ zacharie_carcasse_id: id }),
      loadAdminAuditLogs({ target_type: 'carcasse', target_id: id }),
    ];
  } else if (type === 'user') {
    sources = [
      loadHistoryChanges('user', { id }),
      loadHistoryChanges('user_entity', { owner_id: id }),
      loadLogs({ user_id: id }),
      loadNotifications(id),
      loadAdminAuditLogs({ target_type: 'user', target_id: id }),
    ];
  } else {
    sources = [
      loadHistoryChanges('entity', { id }),
      loadHistoryChanges('user_entity', { entity_id: id }),
      loadAdminAuditLogs({ target_type: 'entity', target_id: id }),
    ];
  }
  const events = (await Promise.all(sources)).flat().sort((a, b) => b.date.localeCompare(a.date));
  return {
    events: await resolveEvents(events.slice(0, TIMELINE_MAX_EVENTS)),
    truncated: events.length > TIMELINE_MAX_EVENTS,
  };
}

type HistoryPageRow = {
  history_id: bigint;
  history_op: string;
  valid_to: Date;
  author_id: string | null;
  row: JsonRow;
  next_row: JsonRow | null;
};

export type HistoryPageFilters = {
  types: Array<AdminHistorySubjectType>;
  authorId: string | null;
  subjectId: string | null;
  from: Date | null;
  to: Date | null;
};

// Dernières modifications, toutes tables confondues (page « Historique » de l'admin). Chaque table est lue
// avec LEAD() pour avoir la version suivante (ou la ligne courante) : l'auteur se filtre ainsi en SQL.
export async function loadHistoryPage(filters: HistoryPageFilters, limit: number, offset: number) {
  // seules Fei, Carcasse et CarcasseIntermediaire savent qui a écrit chaque version
  const types = filters.types.filter((type) => !filters.authorId || HISTORY_SOURCES[type].hasAuthor);
  const results = await Promise.all(
    types.map(async (type) => {
      const source = HISTORY_SOURCES[type];
      const keys = source.keyColumns.map((column) => `t."${column}"`).join(', ');
      const join = source.keyColumns.map((column) => `cur."${column}" = t."${column}"`).join(' AND ');
      const conditions: Array<Prisma.Sql> = [];
      if (filters.authorId) conditions.push(Prisma.sql`author_id = ${filters.authorId}`);
      if (filters.from) conditions.push(Prisma.sql`valid_to >= ${filters.from}`);
      if (filters.to) conditions.push(Prisma.sql`valid_to <= ${filters.to}`);
      if (filters.subjectId) {
        const byKey = source.keyColumns.map((column) => Prisma.sql`row ->> ${column} = ${filters.subjectId}`);
        conditions.push(Prisma.sql`(${Prisma.join(byKey, ' OR ')})`);
      }
      const where = conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
      const authorSql = Prisma.raw(
        source.hasAuthor ? `COALESCE(LEAD(t."version_user_id") OVER w, cur."version_user_id")` : 'NULL::text'
      );
      const versions = Prisma.sql`
        SELECT t."history_id", t."history_op", upper(t."sys_period") AS valid_to,
          ${authorSql} AS author_id,
          to_jsonb(t) - 'sys_period' AS row,
          COALESCE(LEAD(to_jsonb(t) - 'sys_period') OVER w, to_jsonb(cur)) AS next_row
        FROM ${Prisma.raw(`"${source.historyTable}"`)} t
        LEFT JOIN ${Prisma.raw(`"${source.table}"`)} cur ON ${Prisma.raw(join)}
        WINDOW w AS (PARTITION BY ${Prisma.raw(keys)} ORDER BY upper(t."sys_period"), t."history_id")`;
      const [rows, [{ count }]] = await Promise.all([
        prisma.$queryRaw<Array<HistoryPageRow>>`
          SELECT * FROM (${versions}) v WHERE ${where}
          ORDER BY valid_to DESC, history_id DESC LIMIT ${limit + offset}`,
        prisma.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT count(*) AS count FROM (${versions}) v WHERE ${where}`,
      ]);
      const events = rows.flatMap((row) => {
        const version = { ...row, history_id: String(row.history_id) };
        return buildChanges(type, [version], row.next_row).map((event) => ({
          ...event,
          author_id: row.author_id,
        }));
      });
      return { events, count: Number(count) };
    })
  );
  const events = results
    .flatMap((result) => result.events)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(offset, offset + limit);
  return {
    events: await resolveEvents(events),
    total: results.reduce((sum, result) => sum + result.count, 0),
  };
}

const LINK_TYPE: Record<AdminHistorySubjectType, AdminHistoryLinkType> = {
  fei: 'fei',
  carcasse: 'carcasse',
  carcasse_intermediaire: 'carcasse',
  user: 'user',
  entity: 'entity',
  user_entity: 'user',
};

// Emails des auteurs, et libellé + lien de la ligne concernée par chaque événement
async function resolveEvents(events: Array<RawEvent>): Promise<Array<AdminHistoryEvent>> {
  const userIds = new Set<string>();
  const entityIds = new Set<string>();
  const carcasseIds = new Set<string>();
  for (const { author_id, subject } of events) {
    if (author_id) userIds.add(author_id);
    const row = subject.row;
    if (subject.type === 'user') userIds.add(subject.id);
    if (subject.type === 'entity') entityIds.add(subject.id);
    if (subject.type === 'carcasse' && !row) carcasseIds.add(subject.id);
    if (subject.type === 'carcasse_intermediaire' && row) entityIds.add(String(row.intermediaire_entity_id));
    if (subject.type === 'user_entity' && row) {
      userIds.add(String(row.owner_id));
      entityIds.add(String(row.entity_id));
    }
  }
  const [users, entities, carcasses] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, email: true } }),
    prisma.entity.findMany({
      where: { id: { in: [...entityIds] } },
      select: { id: true, nom_d_usage: true },
    }),
    prisma.carcasse.findMany({
      where: { zacharie_carcasse_id: { in: [...carcasseIds] } },
      select: { zacharie_carcasse_id: true, numero_bracelet: true },
    }),
  ]);
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const entityNameById = new Map(entities.map((entity) => [entity.id, entity.nom_d_usage]));
  const braceletById = new Map(
    carcasses.map((carcasse) => [carcasse.zacharie_carcasse_id, carcasse.numero_bracelet])
  );

  return events.map(({ subject, ...event }) => {
    const row = subject.row ?? {};
    let label: string | null = subject.id;
    let linkId: string | null = subject.id;
    if (subject.type === 'carcasse') {
      label = (row.numero_bracelet as string | undefined) ?? braceletById.get(subject.id) ?? subject.id;
    } else if (subject.type === 'carcasse_intermediaire') {
      label = `${row.numero_bracelet} · ${entityNameById.get(String(row.intermediaire_entity_id)) ?? 'intermédiaire'}`;
      linkId = String(row.zacharie_carcasse_id);
    } else if (subject.type === 'user') {
      label = emailById.get(subject.id) ?? subject.id;
    } else if (subject.type === 'entity') {
      label = entityNameById.get(subject.id) ?? subject.id;
    } else if (subject.type === 'user_entity') {
      label = `${emailById.get(String(row.owner_id)) ?? row.owner_id} → ${entityNameById.get(String(row.entity_id)) ?? row.entity_id}`;
      linkId = String(row.owner_id);
    }
    return {
      ...event,
      author_email: event.author_id ? (emailById.get(event.author_id) ?? null) : null,
      subject: {
        type: subject.type,
        id: subject.id,
        label,
        link_type: subject.id ? LINK_TYPE[subject.type] : null,
        link_id: subject.id ? linkId : null,
      },
    };
  });
}
