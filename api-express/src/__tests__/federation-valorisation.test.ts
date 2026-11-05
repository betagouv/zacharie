import { describe, test, expect } from 'vitest';
import { DepotType, FeiOwnerRole } from '@prisma/client';
import { getCircuitValorisation } from '~/utils/federation-stats';

type CarcasseInput = Parameters<typeof getCircuitValorisation>[0];

const carcasse = (overrides: Partial<CarcasseInput> = {}): CarcasseInput => ({
  consommateur_final_usage_domestique: null,
  premier_detenteur_depot_type: null,
  current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  prev_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
  next_owner_role: null,
  CarcasseIntermediaire: [],
  ...overrides,
});

describe('getCircuitValorisation', () => {
  test("une carcasse gardée pour l'usage domestique est comptée en domestique", () => {
    expect(getCircuitValorisation(carcasse({ consommateur_final_usage_domestique: new Date() }))).toBe(
      'domestique'
    );
  });

  test('une carcasse prise en charge par un ETG est comptée en circuit agréé', () => {
    expect(getCircuitValorisation(carcasse({ current_owner_role: FeiOwnerRole.ETG }))).toBe('agree');
    expect(getCircuitValorisation(carcasse({ premier_detenteur_depot_type: DepotType.ETG }))).toBe('agree');
    expect(
      getCircuitValorisation(carcasse({ CarcasseIntermediaire: [{ intermediaire_role: FeiOwnerRole.ETG }] }))
    ).toBe('agree');
  });

  test.each([
    FeiOwnerRole.COMMERCE_DE_DETAIL,
    FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
    FeiOwnerRole.CANTINE_OU_RESTAURATION_COLLECTIVE,
    FeiOwnerRole.ASSOCIATION_CARITATIVE,
    FeiOwnerRole.CONSOMMATEUR_FINAL,
  ])('une carcasse transmise par le premier détenteur à %s est comptée en circuit non agréé', (role) => {
    // le destinataire du circuit court ne prend jamais en charge : le premier détenteur reste
    // propriétaire courant, le destinataire est en `next_owner_role`
    expect(getCircuitValorisation(carcasse({ next_owner_role: role }))).toBe('nonAgree');
  });

  test('une carcasse en route vers un collecteur ou un ETG ne compte dans aucun circuit', () => {
    expect(getCircuitValorisation(carcasse({ next_owner_role: FeiOwnerRole.COLLECTEUR_PRO }))).toBeNull();
    expect(getCircuitValorisation(carcasse({ next_owner_role: FeiOwnerRole.ETG }))).toBeNull();
  });

  test('une carcasse pas encore transmise ne compte dans aucun circuit', () => {
    expect(getCircuitValorisation(carcasse())).toBeNull();
  });
});
