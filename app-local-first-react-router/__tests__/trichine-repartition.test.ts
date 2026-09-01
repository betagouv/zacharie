import { describe, test, expect } from 'vitest';
import {
  erreurPool,
  LIMITES_POOL_FILLE,
  LIMITES_POOL_PETITE_FILLE,
  reconcilierPools,
  repartirEnPools,
  repartirIndividuellement,
  repartirParGroupe,
} from '@app/utils/trichine-repartition';

// Répartition automatique d'un prélèvement en lot : 19 carcasses et 100 g maximum par pool
// (règlement UE 2015/1375, cf doc/trichine.md §9). L'ordre d'entrée est conservé pour que
// la répartition reste prévisible et réordonnable par l'utilisateur.

const lot = (nombre: number, masse = 5) =>
  Array.from({ length: nombre }, (_, index) => ({
    zacharie_carcasse_id: `c${index + 1}`,
    masse_grammes: masse,
  }));

describe('repartirEnPools', () => {
  test('lot vide → aucun pool', () => {
    expect(repartirEnPools([])).toEqual([]);
  });

  test('en dessous des limites → un seul pool', () => {
    expect(repartirEnPools(lot(12))).toEqual([lot(12).map((c) => c.zacharie_carcasse_id)]);
  });

  test('coupe à 19 carcasses', () => {
    const pools = repartirEnPools(lot(40));
    expect(pools.map((pool) => pool.length)).toEqual([19, 19, 2]);
  });

  test('coupe aussi sur la masse', () => {
    // 20 g par carcasse : 5 carcasses saturent les 100 g avant d'atteindre 19
    const pools = repartirEnPools(lot(12, 20));
    expect(pools.map((pool) => pool.length)).toEqual([5, 5, 2]);
  });

  test("conserve l'ordre d'entrée", () => {
    const pools = repartirEnPools(lot(21));
    expect(pools[0][0]).toBe('c1');
    expect(pools[0][18]).toBe('c19');
    expect(pools[1]).toEqual(['c20', 'c21']);
  });

  test('une carcasse plus lourde que la limite reste seule dans son pool', () => {
    const pools = repartirEnPools([
      { zacharie_carcasse_id: 'a', masse_grammes: 5 },
      { zacharie_carcasse_id: 'b', masse_grammes: 150 },
      { zacharie_carcasse_id: 'c', masse_grammes: 5 },
    ]);
    expect(pools).toEqual([['a'], ['b'], ['c']]);
  });
});

describe('erreurPool', () => {
  test('pool conforme → aucune erreur', () => {
    expect(erreurPool(Array(19).fill(5))).toBeNull();
  });

  test('trop de carcasses', () => {
    expect(erreurPool(Array(20).fill(1))).toMatch(/20 carcasses/);
  });

  test('masse dépassée', () => {
    expect(erreurPool([60, 60])).toMatch(/120 g/);
  });
});

describe('repartirParGroupe', () => {
  const detenteurs: Record<string, string> = { c1: 'Alice', c2: 'Bob', c3: 'Alice' };

  test('ne mélange jamais deux groupes', () => {
    const pools = repartirParGroupe(lot(3), (carcasse) => detenteurs[carcasse.zacharie_carcasse_id]);
    expect(pools).toEqual([['c1', 'c3'], ['c2']]);
  });

  test('applique les limites à l’intérieur d’un groupe', () => {
    const pools = repartirParGroupe(lot(25), () => 'Alice');
    expect(pools.map((pool) => pool.length)).toEqual([19, 6]);
  });
});

describe('repartirIndividuellement', () => {
  test('un pool par carcasse', () => {
    expect(repartirIndividuellement(lot(3))).toEqual([['c1'], ['c2'], ['c3']]);
  });
});

describe('reconcilierPools', () => {
  test('retire les carcasses désélectionnées et supprime les pools vides', () => {
    const pools = [
      ['c1', 'c2'],
      ['c3', 'c4'],
    ];
    expect(reconcilierPools(pools, lot(2))).toEqual([['c1', 'c2']]);
  });

  test('répartit automatiquement les carcasses nouvellement ajoutées', () => {
    expect(reconcilierPools([['c2']], lot(3))).toEqual([['c2'], ['c1', 'c3']]);
  });
});

// 2e intention : les limites changent de rang. Une fille regroupe au plus 4 carcasses du pool
// mère, une petite-fille en isole une seule avec 50 g minimum (cf doc/trichine.md §9).
describe('limites des pools de 2e intention', () => {
  test('un pool fille coupe à 4 carcasses, sans limite de masse', () => {
    const pools = repartirEnPools(lot(9, 20), LIMITES_POOL_FILLE);
    expect(pools.map((pool) => pool.length)).toEqual([4, 4, 1]);
  });

  test('un pool fille de 5 carcasses est signalé', () => {
    expect(erreurPool([20, 20, 20, 20, 20], LIMITES_POOL_FILLE)).toMatch(/maximum 4/);
  });

  test('4 carcasses à 20 g passent, alors que 100 g dépasseraient un pool initial', () => {
    expect(erreurPool([20, 20, 20, 20], LIMITES_POOL_FILLE)).toBeNull();
  });

  test('une petite-fille isole une seule carcasse', () => {
    expect(repartirEnPools(lot(3, 50), LIMITES_POOL_PETITE_FILLE).map((pool) => pool.length)).toEqual([
      1, 1, 1,
    ]);
    expect(erreurPool([50, 50], LIMITES_POOL_PETITE_FILLE)).toMatch(/maximum 1/);
  });

  test('une petite-fille sous 50 g est signalée', () => {
    expect(erreurPool([20], LIMITES_POOL_PETITE_FILLE)).toMatch(/minimum 50 g/);
    expect(erreurPool([50], LIMITES_POOL_PETITE_FILLE)).toBeNull();
  });

  test('le regroupement par détenteur respecte aussi les limites du rang', () => {
    const carcasses = [
      ...lot(5, 20).map((c) => ({ ...c, detenteur: 'A' })),
      ...lot(2, 20).map((c) => ({
        ...c,
        zacharie_carcasse_id: `b${c.zacharie_carcasse_id}`,
        detenteur: 'B',
      })),
    ];
    const pools = repartirParGroupe(
      carcasses,
      (carcasse) => (carcasse as never as { detenteur: string }).detenteur,
      LIMITES_POOL_FILLE
    );
    expect(pools.map((pool) => pool.length)).toEqual([4, 1, 2]);
  });
});
