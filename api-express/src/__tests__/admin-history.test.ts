import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminHistoryRouter from '~/controllers/admin/history';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { buildChanges, diffRows, type HistoryVersion } from '~/utils/admin-history';

const app = express();
app.use(express.json());
app.use(adminHistoryRouter);
app.use(sendError);

function version(
  history_id: string,
  row: Record<string, unknown>,
  op = 'UPDATE',
  at = '2026-10-01T10:00:00Z'
) {
  return { history_id, history_op: op, valid_to: new Date(at), row } satisfies HistoryVersion;
}

describe('Historique admin : calcul des changements', () => {
  test('les champs techniques et les tokens de push ne sont jamais affichés, les dates sont en UTC', () => {
    expect(
      diffRows(
        {
          prenom: 'Jean',
          updated_at: 'a',
          version: 1,
          web_push_tokens: ['x'],
          activated_at: null,
        },
        {
          prenom: 'Paul',
          updated_at: 'b',
          version: 2,
          web_push_tokens: ['y'],
          activated_at: '2026-10-01T10:00:00.123',
        }
      )
    ).toEqual([
      { field: 'activated_at', before: null, after: '2026-10-01T10:00:00.123Z' },
      { field: 'prenom', before: 'Jean', after: 'Paul' },
    ]);
  });

  test('chaque version est comparée à la suivante, puis à la ligne courante, avec l’auteur de la version suivante', () => {
    const events = buildChanges(
      'carcasse',
      [
        version(
          '1',
          { zacharie_carcasse_id: 'C1', espece: 'Daim', version_user_id: 'u1' },
          'UPDATE',
          '2026-10-01T10:00:00Z'
        ),
        version(
          '2',
          { zacharie_carcasse_id: 'C1', espece: 'Cerf', version_user_id: 'u2' },
          'UPDATE',
          '2026-10-02T10:00:00Z'
        ),
      ],
      { zacharie_carcasse_id: 'C1', espece: 'Chevreuil', version_user_id: 'u3' }
    );
    expect(events.map((event) => [event.kind, event.author_id, event.changes])).toEqual([
      ['modification', 'u2', [{ field: 'espece', before: 'Daim', after: 'Cerf' }]],
      ['modification', 'u3', [{ field: 'espece', before: 'Cerf', after: 'Chevreuil' }]],
    ]);
    expect(events[0].subject).toMatchObject({ type: 'carcasse', id: 'C1' });
  });

  test('une version sans changement visible est ignorée, une suppression définitive est signalée', () => {
    const events = buildChanges(
      'user_entity',
      [
        version('1', { id: 'r1', status: 'MEMBER', updated_at: 'a' }),
        version('2', { id: 'r1', status: 'MEMBER', updated_at: 'b' }, 'UPDATE'),
        version('3', { id: 'r1', status: 'ADMIN', updated_at: 'c' }, 'DELETE'),
      ],
      null
    );
    expect(events.map((event) => [event.kind, event.author_id])).toEqual([
      ['modification', null],
      ['suppression', null],
    ]);
  });

  test('les tables sans version_user_id n’ont pas d’auteur', () => {
    const [event] = buildChanges('user', [version('1', { id: 'u1', prenom: 'Jean' })], {
      id: 'u1',
      prenom: 'Paul',
      version_user_id: 'u9',
    });
    expect(event.author_id).toBeNull();
  });
});

describe('Historique admin : routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).$queryRaw = vi.fn().mockResolvedValue([]);
    (prisma as any).adminAuditLog.findMany = vi.fn().mockResolvedValue([]);
  });

  test('un type inconnu est refusé', async () => {
    const res = await request(app).get('/history/api_key/k1');
    expect(res.status).toBe(400);
  });

  test('la chronologie d’une entité regroupe ses versions et les actions admin, avec l’email de l’auteur', async () => {
    // la requête des versions et celle de la ligne courante partagent leur gabarit : on distingue par table
    (prisma as any).$queryRaw = vi
      .fn()
      .mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        const table = values.find((value) => typeof value === 'object' && value && 'strings' in value) as
          | { strings: Array<string> }
          | undefined;
        const tableName = table?.strings.join('') ?? '';
        if (sql.includes('AS valid_to') && tableName === '"EntityHistory"') {
          return Promise.resolve([
            {
              history_id: BigInt(1),
              history_op: 'UPDATE',
              valid_to: new Date('2026-10-01T10:00:00Z'),
              row: { id: 'e1', nom_d_usage: 'Ancien nom' },
            },
          ]);
        }
        if (!sql.includes('AS valid_to') && tableName === '"Entity"') {
          return Promise.resolve([{ row: { id: 'e1', nom_d_usage: 'Nouveau nom' } }]);
        }
        return Promise.resolve([]);
      });
    (prisma as any).adminAuditLog.findMany = vi.fn().mockResolvedValue([
      {
        id: 'a1',
        admin_user_id: 'admin-1',
        action: 'POST /entity/:entity_id',
        target_type: 'entity',
        target_id: 'e1',
        before: null,
        after: null,
        body: { nom_d_usage: 'Nouveau nom' },
        status_code: 200,
        created_at: new Date('2026-10-01T10:00:01Z'),
      },
    ]);
    (prisma.user.findMany as any).mockResolvedValue([{ id: 'admin-1', email: 'admin@example.fr' }]);
    (prisma.entity.findMany as any).mockResolvedValue([{ id: 'e1', nom_d_usage: 'Nouveau nom' }]);

    const res = await request(app).get('/history/entity/e1');

    expect(res.status).toBe(200);
    expect(res.body.data.events.map((event: any) => [event.kind, event.title, event.author_email])).toEqual([
      ['admin', 'POST /entity/:entity_id', 'admin@example.fr'],
      ['modification', 'Modification', null],
    ]);
    expect(res.body.data.events[1].changes).toEqual([
      { field: 'nom_d_usage', before: 'Ancien nom', after: 'Nouveau nom' },
    ]);
    expect(res.body.data.events[1].subject).toMatchObject({
      label: 'Nouveau nom',
      link_type: 'entity',
      link_id: 'e1',
    });
  });
});
