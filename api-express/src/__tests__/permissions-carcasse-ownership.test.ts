import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, Prisma, UserRoles } from '@prisma/client';
import { FORCE_FULL_RELOAD_AFTER } from '~/utils/force-full-reload';

// Permissions for the unified GET /carcasse/ endpoint. After the carcasse-first
// refactor, the three role-segmented routes (/carcasse/svi, /carcasse/etg,
// /carcasse/collecteur_pro) collapsed into a single route that branches by
// req.user.roles internally. Permission to see a carcasse derives from
// carcasse-level ownership fields (svi_entity_id, current_owner_entity_id,
// next_owner_entity_id) and CarcasseIntermediaire entity relations — never
// from FEI ownership fields. These tests pin that contract.

const sviUser = {
  id: 'user-svi',
  roles: [UserRoles.SVI],
  activated: true,
  isZacharieAdmin: false,
};

const etgUser = {
  id: 'user-etg',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
};

const collecteurUser = {
  id: 'user-coll',
  roles: [UserRoles.COLLECTEUR_PRO],
  activated: true,
  isZacharieAdmin: false,
};

const chasseurUser = {
  id: 'user-chasseur',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
};

const commerceUser = {
  id: 'user-cc',
  roles: [UserRoles.COMMERCE_DE_DETAIL],
  activated: true,
  isZacharieAdmin: false,
};

const unknownRoleUser = {
  id: 'user-unknown',
  roles: [] as UserRoles[],
  activated: true,
  isZacharieAdmin: false,
};

const inactiveSvi = { ...sviUser, activated: false };

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

// Default required query params (zod schema rejects requests missing any of them)
const DEFAULT_QS = 'after=0&limit=100&withDeleted=false';

function authed(req: request.Test, user: object) {
  return req.set('x-test-user', JSON.stringify(user));
}

// La page d'ids se lit en SQL brut (findScopeCarcassesPage) : on recompose la requête envoyée.
function pageQuery() {
  const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as [TemplateStringsArray, ...any[]];
  return Prisma.sql(strings, ...values);
}

function mockPageIds(ids: Array<string>) {
  vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(ids.map((id) => ({ zacharie_carcasse_id: id })) as any);
  vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce(
    ids.map((id) => ({ zacharie_carcasse_id: id })) as any
  );
}

// vitest.setup.ts doesn't include these — add them for this suite.
(prisma.carcasse as any).count = vi.fn().mockResolvedValue(0);
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
  (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([]);
  (prisma.carcasse as any).count.mockResolvedValue(0);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { entity_id: 'entity-1' } as any,
    { entity_id: 'entity-2' } as any,
  ]);
});

describe('Auth / activation / query validation', () => {
  test('unauthenticated → 401', async () => {
    const res = await request(app).get(`/carcasse?${DEFAULT_QS}`);
    expect(res.status).toBe(401);
  });

  test('non-activated user → 400, no DB query', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), inactiveSvi);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le compte n'est pas activé");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test('missing required query params → 400, no DB query', async () => {
    const res = await authed(request(app).get('/carcasse'), sviUser);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('Role branching — périmètre en SQL brut', () => {
  // Une requête par branche du OR de getCarcasseAccessWhere (cf getCarcasseScopeBranches). Son
  // équivalence avec getCarcasseAccessWhere est vérifiée sur une vraie base dans carcasse-scope.db.test.ts.
  test('SVI user → svi_assigned_at + svi_entity_id / next_owner_entity_id scoped by user entities', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), sviUser);
    expect(res.status).toBe(200);

    // entityAndUserRelations is fetched first to derive the user's entity scope
    expect(prisma.entityAndUserRelations.findMany).toHaveBeenCalledWith({
      where: {
        owner_id: sviUser.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      },
      select: { entity_id: true },
    });

    const query = pageQuery();
    expect(query.sql).toContain('c.svi_entity_id IN');
    expect(query.sql).toContain('c.next_owner_entity_id IN');
    expect(query.sql.match(/c\.svi_assigned_at IS NOT NULL/g)).toHaveLength(2);
    expect(query.sql).toContain('c.deleted_at IS NULL');
    expect(query.values.filter((value) => value === 'entity-1' || value === 'entity-2')).toHaveLength(4);

    // CRITICAL: must NOT scope by FEI ownership fields.
    expect(query.sql).not.toContain('fei_current_owner');
    expect(query.sql).not.toContain('"Fei"');
  });

  test('CHASSEUR user → user ids + entity ids, entité premier détenteur / next seulement une fois transmise', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), chasseurUser);
    expect(res.status).toBe(200);

    const query = pageQuery();
    for (const column of [
      'premier_detenteur_user_id',
      'examinateur_initial_user_id',
      'next_owner_user_id',
      'prev_owner_user_id',
      'current_owner_user_id',
    ]) {
      expect(query.sql).toContain(`c.${column} = `);
    }
    for (const column of [
      'premier_detenteur_entity_id',
      'next_owner_entity_id',
      'prev_owner_entity_id',
      'current_owner_entity_id',
    ]) {
      expect(query.sql).toContain(`c.${column} IN`);
    }
    // Désignation du premier détenteur (entité) : exposée aux membres de l'entité seulement
    // une fois la fiche réellement transmise (sortie de l'examinateur initial).
    expect(query.sql.match(/c\.current_owner_role <> /g)).toHaveLength(2);
    expect(query.values.filter((value) => value === chasseurUser.id)).toHaveLength(5);
    expect(query.sql).toContain('c.deleted_at IS NULL');
  });

  test.each([
    ['ETG', etgUser],
    ['COLLECTEUR_PRO', collecteurUser],
    ['COMMERCE_DE_DETAIL', commerceUser],
  ])('%s → périmètre CarcasseIntermediaire + next_owner + current_owner', async (_label, user) => {
    mockPageIds(['C-1']);
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), user);
    expect(res.status).toBe(200);

    const query = pageQuery();
    expect(query.sql).toContain('"CarcasseIntermediaire" ci');
    expect(query.sql).toContain('c.next_owner_entity_id IN');
    expect(query.sql).toContain('c.current_owner_entity_id IN');
    expect(query.sql).toContain('c.deleted_at IS NULL');
    expect(query.sql).not.toContain('fei_current_owner');
    expect(query.values.filter((value) => value === 'entity-1' || value === 'entity-2')).toHaveLength(6);

    // les carcasses de la page sont relues par id, pas par un where de périmètre
    const findManyArgs = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!;
    expect(findManyArgs.where).toEqual({ zacharie_carcasse_id: { in: ['C-1'] } });
  });

  test.each([
    ['ETG', etgUser],
    ['SVI', sviUser],
  ])('%s sans entité → aucune requête de carcasses', async (_label, user) => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValueOnce([]);
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), user);
    expect(res.status).toBe(200);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('user with no matching role → 403, no carcasse query', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), unknownRoleUser);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Vous n'avez pas les permissions.");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('Pagination + delta-fetch contract', () => {
  test('première page : tri (updated_at, id) décroissant, LIMIT = limit, sans curseur', async () => {
    await authed(request(app).get('/carcasse?after=0&limit=50&withDeleted=false'), sviUser);

    const query = pageQuery();
    expect(query.sql).toContain('ORDER BY u.updated_at DESC, u.zacharie_carcasse_id DESC');
    expect(query.values.at(-1)).toBe(50);
    expect(query.sql).not.toContain('(c.updated_at, c.zacharie_carcasse_id) <');
    expect(query.sql).not.toContain('OFFSET');
  });

  test('page suivante : strictement après le curseur (updated_at, id), périmètre conservé', async () => {
    const cursorDate = new Date('2026-11-01T10:00:00.123Z');
    await authed(
      request(app).get(
        `/carcasse?after=0&limit=50&withDeleted=false&cursorUpdatedAt=${cursorDate.getTime()}&cursorId=ZACH-1_MM-002`
      ),
      sviUser
    );

    const query = pageQuery();
    expect(query.sql).toContain('(c.updated_at, c.zacharie_carcasse_id) <');
    expect(query.values).toContain(cursorDate.toISOString());
    expect(query.values).toContain('ZACH-1_MM-002');
    expect(query.sql).toContain('c.svi_entity_id IN');
  });

  test('ancien bundle : page=0 servie, page>0 refusée en 400 (sinon même page en boucle)', async () => {
    const first = await authed(
      request(app).get('/carcasse?page=0&after=0&limit=50&withDeleted=false'),
      sviUser
    );
    expect(first.status).toBe(200);
    vi.mocked(prisma.$queryRaw).mockClear();

    const next = await authed(
      request(app).get('/carcasse?page=1&after=0&limit=50&withDeleted=false'),
      sviUser
    );
    expect(next.status).toBe(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test('ancien bundle : page=0 pleine → 400 sans charger fiches ni intermédiaires', async () => {
    mockPageIds(['b', 'a']);
    const res = await authed(request(app).get('/carcasse?page=0&after=0&limit=2&withDeleted=false'), sviUser);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Mise à jour de l'application requise");
    expect(prisma.fei.findMany).not.toHaveBeenCalled();
    expect(prisma.carcasseIntermediaire.findMany).not.toHaveBeenCalled();
  });

  test.each([
    ['curseur incomplet', `cursorUpdatedAt=${Date.now()}`],
    ['cursorId vide', `cursorUpdatedAt=${Date.now()}&cursorId=`],
    ['cursorUpdatedAt non numérique', 'cursorUpdatedAt=abc&cursorId=x'],
    ['cursorUpdatedAt hors des dates valides', 'cursorUpdatedAt=99999999999999999999&cursorId=x'],
  ])('%s → 400', async (_label, cursorQs) => {
    const res = await authed(
      request(app).get(`/carcasse?after=0&limit=50&withDeleted=false&${cursorQs}`),
      sviUser
    );
    expect(res.status).toBe(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test('after hors des dates valides → 400', async () => {
    const res = await authed(
      request(app).get('/carcasse?after=99999999999999999999&limit=50&withDeleted=false'),
      sviUser
    );
    expect(res.status).toBe(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test.each(['0', 'abc', '-1', '1.5', '100000'])('limit=%s → 400', async (limit) => {
    const res = await authed(request(app).get(`/carcasse?after=0&limit=${limit}&withDeleted=false`), sviUser);
    expect(res.status).toBe(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test('pas de count() par page : hasMore = page pleine', async () => {
    mockPageIds(['b', 'a']);
    const res = await authed(request(app).get('/carcasse?after=0&limit=2&withDeleted=false'), sviUser);
    expect(res.body.data.hasMore).toBe(true);
    expect(res.body.data.total).toBeUndefined();
    expect(prisma.carcasse.count).not.toHaveBeenCalled();
  });

  test('hasMore se lit sur la page d’ids, même si une carcasse disparaît avant sa relecture', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { zacharie_carcasse_id: 'b' },
      { zacharie_carcasse_id: 'a' },
    ] as any);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([{ zacharie_carcasse_id: 'b' }] as any);
    const res = await authed(request(app).get('/carcasse?after=0&limit=2&withDeleted=false'), etgUser);
    expect(res.body.data.carcasses).toHaveLength(1);
    expect(res.body.data.hasMore).toBe(true);
  });

  test('after=<timestamp> with withDeleted=false → updated_at >= after', async () => {
    // postérieur à FORCE_FULL_RELOAD_AFTER, sinon le serveur force un rechargement complet
    const cutoff = FORCE_FULL_RELOAD_AFTER.getTime() + 1;
    await authed(request(app).get(`/carcasse?after=${cutoff}&limit=100&withDeleted=false`), sviUser);

    const query = pageQuery();
    expect(query.sql).toContain('c.updated_at >=');
    expect(query.values).toContain(new Date(cutoff).toISOString());
    expect(query.sql).toContain('c.deleted_at IS NULL');
  });

  test('withDeleted=true → deleted_at is NOT filtered; updated_at gates the delta', async () => {
    // postérieur à FORCE_FULL_RELOAD_AFTER, sinon le serveur force un rechargement complet
    const cutoff = FORCE_FULL_RELOAD_AFTER.getTime() + 1;
    await authed(request(app).get(`/carcasse?after=${cutoff}&limit=100&withDeleted=true`), sviUser);

    const query = pageQuery();
    expect(query.sql).toContain('c.updated_at >=');
    expect(query.values).toContain(new Date(cutoff).toISOString());
    // when withDeleted=true the controller does NOT filter on deleted_at,
    // so soft-deleted rows updated after the cutoff are visible.
    expect(query.sql).not.toContain('deleted_at');
    // role-based scope is preserved (here: SVI scope)
    expect(query.sql).toContain('c.svi_entity_id IN');
  });

  test('default (withDeleted=false) excludes soft-deleted carcasses', async () => {
    await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), sviUser);
    expect(pageQuery().sql).toContain('c.deleted_at IS NULL');
  });
});

describe('users renvoyés', () => {
  test('un id arbitraire dans current/next/prev_owner_user_id ne sort pas dans users', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ zacharie_carcasse_id: 'ZC-1' }] as any);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValueOnce([
      {
        zacharie_carcasse_id: 'ZC-1',
        fei_numero: 'FEI-1',
        examinateur_initial_user_id: chasseurUser.id,
        premier_detenteur_user_id: 'user-pd',
        created_by_user_id: chasseurUser.id,
        svi_user_id: null,
        current_owner_user_id: 'ARBI1',
        next_owner_user_id: 'ARBI2',
        prev_owner_user_id: 'ARBI3',
      } as any,
    ]);
    (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([
      { intermediaire_user_id: 'user-etg', intermediaire_entity_id: 'entity-1' },
    ]);

    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), chasseurUser);
    expect(res.status).toBe(200);

    const userWhere: any = vi.mocked(prisma.user.findMany).mock.calls[0][0]!.where;
    const ids: string[] = userWhere.id.in;
    expect(ids).toEqual(expect.arrayContaining([chasseurUser.id, 'user-pd', 'user-etg']));
    expect(ids).not.toContain('ARBI1');
    expect(ids).not.toContain('ARBI2');
    expect(ids).not.toContain('ARBI3');
  });
});
