import { describe, test, expect } from 'vitest';
import { EntityTypes } from '@prisma/client';
import {
  sortEntitiesByTypeAndId,
  sortEntitiesRelationsByTypeAndId,
} from '~/utils/sort-things-by-type-and-id.server';
import type { EntityWithUserRelations } from '~/types/entity';

function makeEntity(overrides: Partial<EntityWithUserRelations>): EntityWithUserRelations {
  return {
    id: 'entity-x',
    type: EntityTypes.ETG,
    EntityRelationsWithUsers: [],
    ...overrides,
  } as EntityWithUserRelations;
}

describe('sortEntitiesByTypeAndId', () => {
  test('returns an object keyed by every EntityType, even when input is empty', () => {
    const result = sortEntitiesByTypeAndId([]);

    for (const type of Object.values(EntityTypes)) {
      expect(result[type]).toEqual({});
    }
  });

  test('indexes a single entity under its type and id', () => {
    const entity = makeEntity({ id: 'etg-1', type: EntityTypes.ETG });

    const result = sortEntitiesByTypeAndId([entity]);

    expect(result[EntityTypes.ETG]).toEqual({ 'etg-1': entity });
    expect(result[EntityTypes.SVI]).toEqual({});
  });

  test('groups multiple entities across different types', () => {
    const etg1 = makeEntity({ id: 'etg-1', type: EntityTypes.ETG });
    const etg2 = makeEntity({ id: 'etg-2', type: EntityTypes.ETG });
    const svi1 = makeEntity({ id: 'svi-1', type: EntityTypes.SVI });

    const result = sortEntitiesByTypeAndId([etg1, etg2, svi1]);

    expect(result[EntityTypes.ETG]).toEqual({ 'etg-1': etg1, 'etg-2': etg2 });
    expect(result[EntityTypes.SVI]).toEqual({ 'svi-1': svi1 });
  });

  test('later entity with the same id overwrites the earlier one', () => {
    const first = makeEntity({ id: 'dup', type: EntityTypes.ETG, nom_d_usage: 'first' } as any);
    const second = makeEntity({ id: 'dup', type: EntityTypes.ETG, nom_d_usage: 'second' } as any);

    const result = sortEntitiesByTypeAndId([first, second]);

    expect(result[EntityTypes.ETG]['dup']).toBe(second);
  });
});

describe('sortEntitiesRelationsByTypeAndId', () => {
  test('returns an object keyed by every EntityType, even when input is empty', () => {
    const result = sortEntitiesRelationsByTypeAndId([]);

    for (const type of Object.values(EntityTypes)) {
      expect(result[type]).toEqual({});
    }
  });

  test('indexes entities by type and id', () => {
    const etg = makeEntity({ id: 'etg-1', type: EntityTypes.ETG });
    const svi = makeEntity({ id: 'svi-1', type: EntityTypes.SVI });

    const result = sortEntitiesRelationsByTypeAndId([etg, svi]);

    expect(result[EntityTypes.ETG]['etg-1']).toBe(etg);
    expect(result[EntityTypes.SVI]['svi-1']).toBe(svi);
  });

  test('on duplicate id, FIRST occurrence wins (dedup semantics)', () => {
    const first = makeEntity({ id: 'dup', type: EntityTypes.ETG, nom_d_usage: 'first' } as any);
    const second = makeEntity({ id: 'dup', type: EntityTypes.ETG, nom_d_usage: 'second' } as any);

    const result = sortEntitiesRelationsByTypeAndId([first, second]);

    expect(result[EntityTypes.ETG]['dup']).toBe(first);
  });

  test('skips null/undefined entries safely', () => {
    const etg = makeEntity({ id: 'etg-1', type: EntityTypes.ETG });

    const result = sortEntitiesRelationsByTypeAndId([null as any, etg, undefined as any]);

    expect(result[EntityTypes.ETG]).toEqual({ 'etg-1': etg });
  });
});
