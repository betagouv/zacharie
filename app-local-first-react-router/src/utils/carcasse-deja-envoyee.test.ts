import { describe, test, expect } from 'vitest';
import { FeiOwnerRole } from '@prisma/client';
import {
  isCarcasseDejaEnvoyee,
  isCarcassePriseEnChargeEnAval,
  isPremierDetenteurVerrouille,
} from './carcasse-deja-envoyee';

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

describe('isCarcassePriseEnChargeEnAval', () => {
  test('destinataire choisi mais pas encore pris en charge : le chasseur garde la main', () => {
    expect(isCarcassePriseEnChargeEnAval({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR })).toBe(false);
  });

  test('prise en charge par un ETG : le chasseur est dessaisi', () => {
    expect(isCarcassePriseEnChargeEnAval({ current_owner_role: FeiOwnerRole.ETG })).toBe(true);
  });

  test('carcasse tout juste créée : le chasseur garde la main', () => {
    expect(isCarcassePriseEnChargeEnAval({ current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL })).toBe(
      false
    );
  });

  test('rôle absent : le chasseur garde la main', () => {
    expect(isCarcassePriseEnChargeEnAval({ current_owner_role: null })).toBe(false);
  });
});

describe('isPremierDetenteurVerrouille', () => {
  test('carcasse tout juste créée : propriétaire initial modifiable', () => {
    expect(
      isPremierDetenteurVerrouille({
        next_owner_role: null,
        current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
      })
    ).toBe(false);
  });

  test('premier détenteur désigné (utilisateur ou association) : propriétaire initial modifiable', () => {
    expect(
      isPremierDetenteurVerrouille({
        next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
      })
    ).toBe(false);
  });

  test('chez le premier détenteur, sans destinataire : propriétaire initial modifiable', () => {
    expect(
      isPremierDetenteurVerrouille({
        next_owner_role: null,
        current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      })
    ).toBe(false);
  });

  test('transmise à un collecteur, pas encore prise en charge : verrouillé', () => {
    expect(
      isPremierDetenteurVerrouille({
        next_owner_role: FeiOwnerRole.COLLECTEUR_PRO,
        current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      })
    ).toBe(true);
  });

  test('gardée pour usage domestique : verrouillé', () => {
    expect(
      isPremierDetenteurVerrouille({
        next_owner_role: null,
        current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        consommateur_final_usage_domestique: new Date(),
      })
    ).toBe(true);
  });

  test('prise en charge par un ETG : verrouillé', () => {
    expect(
      isPremierDetenteurVerrouille({
        next_owner_role: null,
        current_owner_role: FeiOwnerRole.ETG,
      })
    ).toBe(true);
  });
});
