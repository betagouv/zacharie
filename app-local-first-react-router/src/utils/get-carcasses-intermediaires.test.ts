import { describe, it, expect, vi } from 'vitest';
import type { CarcasseIntermediaire } from '@prisma/client';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/carcasses-intermediaire';

// le store (IndexedDB) n'est pas utile ici : on ne teste que la fonction pure
vi.mock('@app/zustand/store', () => ({ default: () => null }));

const { filterCarcassesIntermediairesForCarcasse } = await import('./get-carcasses-intermediaires');

type ById = Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>;

function ci(
  zacharie_carcasse_id: string,
  intermediaire_id: string,
  created_at: string,
  deleted_at: Date | null = null
): CarcasseIntermediaire {
  return {
    fei_numero: 'ZACH-TEST-001',
    zacharie_carcasse_id,
    intermediaire_id,
    created_at: new Date(created_at),
    deleted_at,
  } as CarcasseIntermediaire;
}

function byIdOf(items: Array<CarcasseIntermediaire>): ById {
  return Object.fromEntries(
    items.map((item) => [`${item.fei_numero}__${item.zacharie_carcasse_id}__${item.intermediaire_id}`, item])
  ) as ById;
}

describe('filterCarcassesIntermediairesForCarcasse', () => {
  const byId = byIdOf([
    ci('C1', 'collecteur', '2026-11-01T08:00:00Z'),
    ci('C1', 'etg', '2026-11-02T08:00:00Z'),
    ci('C1', 'etg-supprime', '2026-11-03T08:00:00Z', new Date('2026-11-03T09:00:00Z')),
    ci('C2', 'etg', '2026-11-02T08:00:00Z'),
  ]);

  it('renvoie les intermédiaires de la carcasse, le plus récent en premier, avec leur id', () => {
    const result = filterCarcassesIntermediairesForCarcasse(byId, 'C1');
    expect(result.map((r) => r.id)).toEqual(['etg', 'collecteur']);
  });

  it('ignore les intermédiaires supprimés et ceux des autres carcasses', () => {
    expect(filterCarcassesIntermediairesForCarcasse(byId, 'C2').map((r) => r.id)).toEqual(['etg']);
    expect(filterCarcassesIntermediairesForCarcasse(byId, 'INCONNUE')).toEqual([]);
  });

  it('suit une nouvelle version du store', () => {
    const next = { ...byId, ...byIdOf([ci('C2', 'svi', '2026-11-04T08:00:00Z')]) };
    expect(filterCarcassesIntermediairesForCarcasse(byId, 'C2').map((r) => r.id)).toEqual(['etg']);
    expect(filterCarcassesIntermediairesForCarcasse(next, 'C2').map((r) => r.id)).toEqual(['svi', 'etg']);
  });
});
