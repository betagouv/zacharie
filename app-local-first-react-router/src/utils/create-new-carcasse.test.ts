import { describe, it, expect } from 'vitest';
import { Carcasse, FeiOwnerRole } from '@prisma/client';
import { isFeiTransmise } from './create-new-carcasse';

function carcasse(overrides: Partial<Carcasse> = {}): Carcasse {
  return {
    zacharie_carcasse_id: 'FEI-1_BR1',
    fei_numero: 'FEI-1',
    deleted_at: null,
    current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
    next_owner_entity_id: null,
    next_owner_user_id: null,
    svi_assigned_at: null,
    svi_closed_at: null,
    svi_automatic_closed_at: null,
    intermediaire_closed_at: null,
    ...overrides,
  } as unknown as Carcasse;
}

describe('isFeiTransmise', () => {
  it('false while at the examinateur stage', () => {
    expect(isFeiTransmise([carcasse(), carcasse({ zacharie_carcasse_id: 'FEI-1_BR2' })])).toBe(false);
  });

  it('false while held by the premier détenteur (destinataire pas encore transmis)', () => {
    expect(isFeiTransmise([carcasse({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR })])).toBe(false);
  });

  it('true when a carcasse has a next owner (envoyée à un prochain détenteur)', () => {
    expect(isFeiTransmise([carcasse({ next_owner_entity_id: 'etg-1' })])).toBe(true);
    expect(isFeiTransmise([carcasse({ next_owner_user_id: 'user-1' })])).toBe(true);
  });

  it('true when a carcasse is received downstream (collecteur / ETG / SVI)', () => {
    expect(isFeiTransmise([carcasse({ current_owner_role: FeiOwnerRole.COLLECTEUR_PRO })])).toBe(true);
    expect(isFeiTransmise([carcasse({ current_owner_role: FeiOwnerRole.ETG })])).toBe(true);
    expect(isFeiTransmise([carcasse({ current_owner_role: FeiOwnerRole.SVI })])).toBe(true);
  });

  it('true when a carcasse is svi-assigned / closed / intermediaire-closed', () => {
    expect(isFeiTransmise([carcasse({ svi_assigned_at: new Date() })])).toBe(true);
    expect(isFeiTransmise([carcasse({ svi_closed_at: new Date() })])).toBe(true);
    expect(isFeiTransmise([carcasse({ intermediaire_closed_at: new Date() })])).toBe(true);
  });

  it('ignores deleted carcasses', () => {
    expect(
      isFeiTransmise([
        carcasse({ current_owner_role: FeiOwnerRole.ETG, deleted_at: new Date() }),
        carcasse({ zacharie_carcasse_id: 'FEI-1_BR2' }),
      ])
    ).toBe(false);
  });

  it('true if at least one live carcasse is downstream among others still upstream', () => {
    expect(
      isFeiTransmise([
        carcasse(),
        carcasse({ zacharie_carcasse_id: 'FEI-1_BR2', current_owner_role: FeiOwnerRole.COLLECTEUR_PRO }),
      ])
    ).toBe(true);
  });
});
