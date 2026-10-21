import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { z } from 'zod';
import prisma from '~/prisma';
import { MATOMO_SITE_ID } from '~/config';
import { matomoBulkRequest, type MatomoRequestParams } from '~/third-parties/matomo-reporting';

dayjs.extend(utc);
dayjs.extend(timezone);

const MATOMO_TIMEZONE = 'Europe/Paris';
const DAY_FORMAT = 'YYYY-MM-DD';
const UPSERT_BATCH_SIZE = 1000;

export type MatomoVisitsRow = {
  date: string;
  nb_visits: number;
  nb_uniq_visitors: number | null;
  nb_actions: number;
  bounce_rate: number;
  avg_time_on_site: number;
};
export type MatomoPagesRow = {
  date: string;
  url: string;
  label: string;
  nb_visits: number;
  nb_hits: number;
  avg_time_on_page: number;
};
export type MatomoEventsRow = {
  date: string;
  category: string;
  action: string;
  nb_events: number;
  nb_visits: number;
};
export type MatomoReferrersRow = {
  date: string;
  referrer_type: string;
  nb_visits: number;
};

export type DateRange = { from: string; to: string };

/*
 *
 * Requêtes
 *
 */

export function buildReportRequests(siteId: string, { from, to }: DateRange): Array<MatomoRequestParams> {
  const common = { idSite: siteId, period: 'day', date: `${from},${to}`, format: 'json', language: 'fr' };
  return [
    { ...common, method: 'VisitsSummary.get' },
    { ...common, method: 'Actions.getPageUrls', flat: '1', filter_limit: '-1' },
    // `flat=1` concatène catégorie et action dans un seul libellé : on lit plutôt les sous-tables
    {
      ...common,
      method: 'Events.getCategory',
      secondaryDimension: 'eventAction',
      expanded: '1',
      filter_limit: '-1',
    },
    { ...common, method: 'Referrers.getReferrerType', flat: '1', filter_limit: '-1' },
  ];
}

/*
 *
 * Parsing des réponses
 * Avec period=day et une plage de dates, chaque rapport est un objet indexé par jour.
 * Un jour sans donnée vaut [] pour VisitsSummary.get.
 *
 */

const count = z.coerce.number().transform(Math.round);
const label = z.coerce.string();
const byDay = <T extends z.ZodTypeAny>(day: T) => z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), day);

const visitsSchema = byDay(
  z.union([
    z.array(z.unknown()).max(0),
    z.object({
      nb_visits: count,
      nb_uniq_visitors: count.optional(),
      nb_actions: count,
      bounce_rate: z.union([
        z.number(),
        z
          .string()
          .regex(/^[\d.]+%?$/)
          .transform(parseFloat),
      ]),
      avg_time_on_site: count,
    }),
  ])
);
const pagesSchema = byDay(
  z.array(
    z.object({
      label,
      url: z.string().optional(),
      nb_visits: count,
      nb_hits: count,
      avg_time_on_page: count,
    })
  )
);
const eventCountsSchema = z.object({ label, nb_events: count, nb_visits: count });
const eventsSchema = byDay(z.array(eventCountsSchema.extend({ subtable: z.array(eventCountsSchema) })));
const referrersSchema = byDay(z.array(z.object({ label, nb_visits: count })));

export function parseVisits(payload: unknown): Array<MatomoVisitsRow> {
  return Object.entries(visitsSchema.parse(payload)).flatMap(([date, day]) =>
    Array.isArray(day)
      ? []
      : [
          {
            date,
            nb_visits: day.nb_visits,
            nb_uniq_visitors: day.nb_uniq_visitors ?? null,
            nb_actions: day.nb_actions,
            bounce_rate: day.bounce_rate,
            avg_time_on_site: day.avg_time_on_site,
          },
        ]
  );
}

// Plusieurs libellés aplatis peuvent pointer vers la même URL (ligne « Autres » comprise) :
// on les fusionne pour respecter la clé (date, url).
export function parsePages(payload: unknown): Array<MatomoPagesRow> {
  const rows = new Map<string, MatomoPagesRow>();
  for (const [date, pages] of Object.entries(pagesSchema.parse(payload))) {
    for (const page of pages) {
      const url = page.url ?? page.label;
      const key = `${date}|${url}`;
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, {
          date,
          url,
          label: page.label,
          nb_visits: page.nb_visits,
          nb_hits: page.nb_hits,
          avg_time_on_page: page.avg_time_on_page,
        });
        continue;
      }
      const nb_hits = existing.nb_hits + page.nb_hits;
      existing.avg_time_on_page = nb_hits
        ? Math.round(
            (existing.avg_time_on_page * existing.nb_hits + page.avg_time_on_page * page.nb_hits) / nb_hits
          )
        : 0;
      existing.nb_hits = nb_hits;
      existing.nb_visits += page.nb_visits;
    }
  }
  return [...rows.values()];
}

export function parseEvents(payload: unknown): Array<MatomoEventsRow> {
  return Object.entries(eventsSchema.parse(payload)).flatMap(([date, categories]) =>
    categories.flatMap((category) =>
      category.subtable.map((action) => ({
        date,
        category: category.label,
        action: action.label,
        nb_events: action.nb_events,
        nb_visits: action.nb_visits,
      }))
    )
  );
}

export function parseReferrers(payload: unknown): Array<MatomoReferrersRow> {
  return Object.entries(referrersSchema.parse(payload)).flatMap(([date, referrers]) =>
    referrers.map((referrer) => ({ date, referrer_type: referrer.label, nb_visits: referrer.nb_visits }))
  );
}

/*
 *
 * Dates
 *
 */

// J-7 → J-1 : Matomo peut consolider une journée tardivement
export function slidingWindow(now: Date = new Date()): DateRange {
  const today = dayjs(now).tz(MATOMO_TIMEZONE);
  return {
    from: today.subtract(7, 'day').format(DAY_FORMAT),
    to: today.subtract(1, 'day').format(DAY_FORMAT),
  };
}

export function splitByMonth({ from, to }: DateRange): Array<DateRange> {
  const end = dayjs.utc(to);
  const ranges: Array<DateRange> = [];
  let start = dayjs.utc(from);
  while (!start.isAfter(end)) {
    const endOfMonth = start.endOf('month');
    const chunkEnd = endOfMonth.isBefore(end) ? endOfMonth : end;
    ranges.push({ from: start.format(DAY_FORMAT), to: chunkEnd.format(DAY_FORMAT) });
    start = chunkEnd.add(1, 'day').startOf('day');
  }
  return ranges;
}

/*
 *
 * Écriture
 *
 */

type Row = Record<string, string | number | null>;

async function upsertRows<T extends Row>(
  table: string,
  keyColumns: Array<keyof T & string>,
  valueColumns: Array<keyof T & string>,
  rows: Array<T>
): Promise<number> {
  if (!rows.length) return 0;
  const columns = [...keyColumns, ...valueColumns];
  const columnsSql = Prisma.raw([...columns, 'synced_at'].map((column) => `"${column}"`).join(', '));
  const updateSql = Prisma.raw(
    [...valueColumns, 'synced_at'].map((column) => `"${column}" = EXCLUDED."${column}"`).join(', ')
  );
  const conflictSql = Prisma.raw(keyColumns.map((column) => `"${column}"`).join(', '));

  let upserted = 0;
  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const values = rows
      .slice(index, index + UPSERT_BATCH_SIZE)
      .map(
        (row) =>
          Prisma.sql`(${Prisma.join(
            columns.map((column) =>
              column === 'date' ? Prisma.sql`${row[column]}::date` : Prisma.sql`${row[column]}`
            )
          )}, NOW())`
      );
    upserted += await prisma.$executeRaw`
      INSERT INTO ${Prisma.raw(`"${table}"`)} (${columnsSql})
      VALUES ${Prisma.join(values)}
      ON CONFLICT (${conflictSql}) DO UPDATE SET ${updateSql}
    `;
  }
  return upserted;
}

export async function syncMatomoStats(range: DateRange): Promise<void> {
  if (!MATOMO_SITE_ID) throw new Error('MATOMO_SITE_ID non configuré');
  const startedAt = Date.now();
  const [visits, pages, events, referrers] = await matomoBulkRequest(
    buildReportRequests(MATOMO_SITE_ID, range)
  );

  // tout est validé avant la première écriture : un rapport invalide n'écrit rien
  const rows = {
    visits: parseVisits(visits),
    pages: parsePages(pages),
    events: parseEvents(events),
    referrers: parseReferrers(referrers),
  };

  const counts = {
    matomo_visits_daily: await upsertRows(
      'matomo_visits_daily',
      ['date'],
      ['nb_visits', 'nb_uniq_visitors', 'nb_actions', 'bounce_rate', 'avg_time_on_site'],
      rows.visits
    ),
    matomo_pages_daily: await upsertRows(
      'matomo_pages_daily',
      ['date', 'url'],
      ['label', 'nb_visits', 'nb_hits', 'avg_time_on_page'],
      rows.pages
    ),
    matomo_events_daily: await upsertRows(
      'matomo_events_daily',
      ['date', 'category', 'action'],
      ['nb_events', 'nb_visits'],
      rows.events
    ),
    matomo_referrers_daily: await upsertRows(
      'matomo_referrers_daily',
      ['date', 'referrer_type'],
      ['nb_visits'],
      rows.referrers
    ),
  };

  const summary = Object.entries(counts)
    .map(([table, upserted]) => `${table}=${upserted}`)
    .join(' ');
  console.log(`Matomo ${range.from} → ${range.to} : ${summary} (${Date.now() - startedAt} ms)`);
}
