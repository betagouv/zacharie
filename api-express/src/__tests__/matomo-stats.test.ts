import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import prisma from '~/prisma';
import { MatomoApiError, matomoBulkRequest, throwIfMatomoError } from '~/third-parties/matomo-reporting';
import {
  buildReportRequests,
  parseEvents,
  parsePages,
  parseReferrers,
  parseVisits,
  slidingWindow,
  splitByMonth,
  syncMatomoStats,
} from '~/utils/matomo-stats';
import visitsSummary from './fixtures/matomo/visits-summary.json';
import pageUrls from './fixtures/matomo/page-urls.json';
import eventsCategoryAction from './fixtures/matomo/events-category-action.json';
import referrerType from './fixtures/matomo/referrer-type.json';

vi.mock('~/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/config')>()),
  MATOMO_URL: 'https://stats.example.fr/',
  MATOMO_TOKEN: 'token-de-test',
  MATOMO_SITE_ID: '42',
}));

function mockFetchResponse(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(prisma.$executeRaw).mockReset().mockResolvedValue(1);
});

describe('parseVisits', () => {
  it('mappe un jour et ignore les jours sans visite', () => {
    expect(parseVisits(visitsSummary)).toEqual([
      {
        date: '2026-10-13',
        nb_visits: 341,
        nb_uniq_visitors: 212,
        nb_actions: 2874,
        bounce_rate: 15,
        avg_time_on_site: 629,
      },
    ]);
  });

  it('rejette un taux de rebond illisible', () => {
    const payload = { '2026-10-13': { ...visitsSummary['2026-10-13'], bounce_rate: 'n/a' } };
    expect(() => parseVisits(payload)).toThrow();
  });
});

describe('parsePages', () => {
  it('fusionne les libellés qui pointent vers la même URL', () => {
    const rows = parsePages(pageUrls);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      date: '2026-10-13',
      url: 'https://zacharie.beta.gouv.fr/app/chasseur',
      label: 'app/chasseur',
      nb_visits: 160,
      nb_hits: 404,
      avg_time_on_page: 30,
    });
  });

  it('prend le libellé comme clé quand Matomo ne donne pas d’URL', () => {
    expect(parsePages(pageUrls).at(-1)).toMatchObject({ url: 'Autres', label: 'Autres', nb_hits: 6 });
  });
  it('masque les jetons et emails passés en paramètre d’URL, et fusionne les lignes ainsi rendues identiques', () => {
    const invitation = (token: string, email: string) => ({
      label: `app/connexion/invitation?invitation-token=${token}&email=${email}`,
      url: `https://zacharie.beta.gouv.fr/app/connexion/invitation?invitation-token=${token}&email=${email}`,
      nb_visits: 1,
      nb_hits: 1,
      avg_time_on_page: 20,
    });
    const rows = parsePages({
      '2026-10-13': [invitation('abc123', 'jean%40example.fr'), invitation('def456', 'marie%40example.fr')],
    });
    expect(rows).toEqual([
      {
        date: '2026-10-13',
        url: 'https://zacharie.beta.gouv.fr/app/connexion/invitation?invitation-token=[masqué]&email=[masqué]',
        label: 'app/connexion/invitation?invitation-token=[masqué]&email=[masqué]',
        nb_visits: 2,
        nb_hits: 2,
        avg_time_on_page: 20,
      },
    ]);
  });
});

describe('parseEvents', () => {
  it('produit une ligne par couple catégorie × action', () => {
    expect(parseEvents(eventsCategoryAction)).toEqual([
      { date: '2026-10-13', category: 'fiche', action: 'creer', nb_events: 45, nb_visits: 29 },
      { date: '2026-10-13', category: 'fiche', action: 'transmettre', nb_events: 32, nb_visits: 20 },
      {
        date: '2026-10-13',
        category: 'clic',
        action: 'fiche-voir-toutes-les-fiches',
        nb_events: 19,
        nb_visits: 12,
      },
    ]);
  });

  it('rejette une catégorie sans sous-table d’actions', () => {
    expect(() => parseEvents({ '2026-10-13': [{ label: 'fiche', nb_events: 1, nb_visits: 1 }] })).toThrow();
  });
});

describe('parseReferrers', () => {
  it('mappe chaque type de provenance', () => {
    expect(parseReferrers(referrerType)).toEqual([
      { date: '2026-10-13', referrer_type: 'Entrée directe', nb_visits: 301 },
      { date: '2026-10-13', referrer_type: 'Moteurs de recherche', nb_visits: 27 },
      { date: '2026-10-13', referrer_type: 'Sites web', nb_visits: 13 },
    ]);
  });
});

describe('dates', () => {
  it('la fenêtre glissante va de J-7 à J-1 dans le fuseau de Paris', () => {
    // 21 octobre 00h30 à Paris, encore le 20 en UTC
    expect(slidingWindow(new Date('2026-10-20T22:30:00Z'))).toEqual({ from: '2026-10-14', to: '2026-10-20' });
  });

  it('découpe une plage par mois calendaire', () => {
    expect(splitByMonth({ from: '2026-01-15', to: '2026-03-02' })).toEqual([
      { from: '2026-01-15', to: '2026-01-31' },
      { from: '2026-02-01', to: '2026-02-28' },
      { from: '2026-03-01', to: '2026-03-02' },
    ]);
    expect(splitByMonth({ from: '2026-10-05', to: '2026-10-05' })).toEqual([
      { from: '2026-10-05', to: '2026-10-05' },
    ]);
  });
});

describe('matomoBulkRequest', () => {
  it('envoie un POST avec le token dans le body et une sous-requête encodée par rapport', async () => {
    const fetchMock = mockFetchResponse([{}, {}, {}, {}]);
    await matomoBulkRequest(buildReportRequests('42', { from: '2026-10-14', to: '2026-10-20' }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://stats.example.fr/index.php');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(init.body.toString());
    expect(body.get('method')).toBe('API.getBulkRequest');
    expect(body.get('token_auth')).toBe('token-de-test');
    const events = new URLSearchParams(body.get('urls[2]') ?? '');
    expect(Object.fromEntries(events)).toMatchObject({
      method: 'Events.getCategory',
      idSite: '42',
      period: 'day',
      date: '2026-10-14,2026-10-20',
      secondaryDimension: 'eventAction',
      expanded: '1',
    });
  });

  it('lève l’erreur renvoyée en 200 par Matomo', async () => {
    mockFetchResponse({ result: 'error', message: "You can't access this resource" });
    await expect(matomoBulkRequest([{ method: 'VisitsSummary.get' }])).rejects.toThrow(MatomoApiError);
  });

  it('lève l’erreur d’une sous-requête', async () => {
    mockFetchResponse([{}, { result: 'error', message: 'Method not found' }]);
    await expect(matomoBulkRequest([{}, {}])).rejects.toThrow('Method not found');
  });

  it('ignore une réponse qui n’est pas une erreur', () => {
    expect(() => throwIfMatomoError(visitsSummary)).not.toThrow();
  });
});

describe('syncMatomoStats', () => {
  const range = { from: '2026-10-13', to: '2026-10-14' };

  it('upsert les quatre rapports', async () => {
    mockFetchResponse([visitsSummary, pageUrls, eventsCategoryAction, referrerType]);
    await syncMatomoStats(range);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(4);

    const [strings, ...values] = vi.mocked(prisma.$executeRaw).mock.calls[2] as [
      TemplateStringsArray,
      ...Array<unknown>,
    ];
    const query = Prisma.sql(strings, ...values);
    expect(query.text.replace(/\s+/g, ' ')).toContain(
      'INSERT INTO "matomo_events_daily" ("date", "category", "action", "nb_events", "nb_visits", "synced_at") VALUES ($1::date,$2,$3,$4,$5, NOW())'
    );
    expect(query.text).toContain(
      'ON CONFLICT ("date", "category", "action") DO UPDATE SET "nb_events" = EXCLUDED."nb_events", "nb_visits" = EXCLUDED."nb_visits", "synced_at" = EXCLUDED."synced_at"'
    );
    expect(query.values.slice(0, 5)).toEqual(['2026-10-13', 'fiche', 'creer', 45, 29]);
  });

  it('n’écrit rien si un rapport est invalide', async () => {
    mockFetchResponse([visitsSummary, pageUrls, { '2026-10-13': 'cassé' }, referrerType]);
    await expect(syncMatomoStats(range)).rejects.toThrow();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
