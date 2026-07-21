import { describe, it, expect } from 'vitest';
import { Carcasse, Fei, FeiOwnerRole } from '@prisma/client';
import { isFeiTransmise } from './create-new-carcasse';

function fei(overrides: Partial<Fei> = {}): Fei {
  return {
    numero: 'FEI-1',
    examinateur_initial_approbation_mise_sur_le_marche: null,
    ...overrides,
  } as unknown as Fei;
}

function carcasse(overrides: Partial<Carcasse> = {}): Carcasse {
  return {
    zacharie_carcasse_id: 'FEI-1_BR1',
    fei_numero: 'FEI-1',
    deleted_at: null,
    current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
    next_owner_entity_id: null,
    next_owner_user_id: null,
    ...overrides,
  } as unknown as Carcasse;
}

describe('isFeiTransmise', () => {
  it('false while the exam is ongoing (no approbation, all carcasses at examinateur)', () => {
    expect(isFeiTransmise(fei(), [carcasse(), carcasse({ zacharie_carcasse_id: 'FEI-1_BR2' })])).toBe(false);
  });

  it('true once the examinateur approved for market', () => {
    expect(
      isFeiTransmise(fei({ examinateur_initial_approbation_mise_sur_le_marche: true }), [carcasse()])
    ).toBe(true);
  });

  it('true when a carcasse moved past the examinateur (premier détenteur)', () => {
    expect(isFeiTransmise(fei(), [carcasse({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR })])).toBe(
      true
    );
  });

  it('true when a carcasse has a next owner (sent onward)', () => {
    expect(isFeiTransmise(fei(), [carcasse({ next_owner_entity_id: 'etg-1' })])).toBe(true);
    expect(isFeiTransmise(fei(), [carcasse({ next_owner_user_id: 'user-1' })])).toBe(true);
  });

  it('ignores deleted carcasses', () => {
    expect(
      isFeiTransmise(fei(), [
        carcasse({ current_owner_role: FeiOwnerRole.ETG, deleted_at: new Date() }),
        carcasse({ zacharie_carcasse_id: 'FEI-1_BR2' }),
      ])
    ).toBe(false);
  });

  it('true if at least one live carcasse is transmise among others still at examinateur', () => {
    expect(
      isFeiTransmise(fei(), [
        carcasse(),
        carcasse({ zacharie_carcasse_id: 'FEI-1_BR2', current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR }),
      ])
    ).toBe(true);
  });
});
