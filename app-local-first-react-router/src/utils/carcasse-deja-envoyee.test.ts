import { describe, test, expect } from 'vitest';
import { FeiOwnerRole } from '@prisma/client';
import { isCarcasseDejaEnvoyee } from './carcasse-deja-envoyee';

describe('isCarcasseDejaEnvoyee', () => {
  test('carcasse tout juste créée : encore chez le chasseur', () => {
    expect(
      isCarcasseDejaEnvoyee({
        next_owner_entity_id: null,
        current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
      })
    ).toBe(false);
  });

  test('carcasse chez le premier détenteur, sans destinataire : encore chez le chasseur', () => {
    expect(
      isCarcasseDejaEnvoyee({
        next_owner_entity_id: null,
        current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      })
    ).toBe(false);
  });

  test('destinataire choisi mais pas encore pris en charge : déjà partie', () => {
    expect(
      isCarcasseDejaEnvoyee({
        next_owner_entity_id: 'ETG-1',
        current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      })
    ).toBe(true);
  });

  test('prise en charge par un ETG : déjà partie', () => {
    expect(isCarcasseDejaEnvoyee({ next_owner_entity_id: null, current_owner_role: FeiOwnerRole.ETG })).toBe(
      true
    );
  });

  // L'invariant violé du check n°1 de data-health : rôle EXAMINATEUR_INITIAL avec une entité aval.
  // La carcasse est chez le chasseur — c'est l'entité qui est parasite, pas le rôle.
  test('rôle EXAMINATEUR_INITIAL avec une entité parasite : reste chez le chasseur', () => {
    expect(
      isCarcasseDejaEnvoyee({
        next_owner_entity_id: null,
        current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
      })
    ).toBe(false);
  });

  test('rôle absent : pas encore engagée, donc encore chez le chasseur', () => {
    expect(isCarcasseDejaEnvoyee({ next_owner_entity_id: null, current_owner_role: null })).toBe(false);
  });

  test('champs absents (transmission partielle) : encore chez le chasseur', () => {
    expect(isCarcasseDejaEnvoyee({})).toBe(false);
  });
});
