import { describe, expect, it } from 'vitest';
import { EntityRelationType, type Carcasse } from '@prisma/client';
import type { EntityWithUserRelation } from '~/src/types/entity';
import { getPrefillFromPreviousCarcasses } from './usePrefillPremierDétenteur';

const ccgId = 'ccg-1';
const collecteurId = 'collecteur-1';

function previousCarcasse(overrides: Partial<Carcasse> = {}): Record<string, Carcasse> {
  return {
    'old-fei_1': {
      zacharie_carcasse_id: 'old-fei_1',
      premier_detenteur_depot_type: 'CCG',
      premier_detenteur_depot_entity_id: ccgId,
      premier_detenteur_depot_entity_name_cache: 'CCG des Angles',
      premier_detenteur_prochain_detenteur_id_cache: collecteurId,
      premier_detenteur_prochain_detenteur_role_cache: 'COLLECTEUR_PRO',
      premier_detenteur_transport_type: 'COLLECTEUR_PRO',
      premier_detenteur_user_id: 'chasseur-1',
      premier_detenteur_entity_id: null,
      ...overrides,
    } as Carcasse,
  };
}

function entity(id: string, overrides: Partial<EntityWithUserRelation> = {}): EntityWithUserRelation {
  return {
    id,
    deleted_at: null,
    relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
    ...overrides,
  } as EntityWithUserRelation;
}

describe('getPrefillFromPreviousCarcasses', () => {
  it('reprend le dépôt et le prochain détenteur de la dernière transmission', () => {
    const prefill = getPrefillFromPreviousCarcasses(previousCarcasse(), {
      [ccgId]: entity(ccgId),
      [collecteurId]: entity(collecteurId),
    });
    expect(prefill?.premier_detenteur_depot_entity_id).toBe(ccgId);
    expect(prefill?.premier_detenteur_depot_entity_name_cache).toBe('CCG des Angles');
    expect(prefill?.premier_detenteur_prochain_detenteur_id_cache).toBe(collecteurId);
    expect(prefill?.premier_detenteur_prochain_detenteur_role_cache).toBe('COLLECTEUR_PRO');
  });

  it("ne propose pas un CCG supprimé (absent des entités de l'utilisateur)", () => {
    const prefill = getPrefillFromPreviousCarcasses(previousCarcasse(), {
      [collecteurId]: entity(collecteurId),
    });
    expect(prefill?.premier_detenteur_depot_entity_id).toBeNull();
    expect(prefill?.premier_detenteur_depot_entity_name_cache).toBeNull();
    expect(prefill?.premier_detenteur_prochain_detenteur_id_cache).toBe(collecteurId);
  });

  it('ne propose pas un CCG connu seulement par une ancienne fiche, ou marqué supprimé', () => {
    const asReference = getPrefillFromPreviousCarcasses(previousCarcasse(), {
      [ccgId]: entity(ccgId, { relation: EntityRelationType.NONE }),
      [collecteurId]: entity(collecteurId),
    });
    expect(asReference?.premier_detenteur_depot_entity_id).toBeNull();
    const deleted = getPrefillFromPreviousCarcasses(previousCarcasse(), {
      [ccgId]: entity(ccgId, { deleted_at: new Date() }),
      [collecteurId]: entity(collecteurId),
    });
    expect(deleted?.premier_detenteur_depot_entity_id).toBeNull();
  });

  it('ne propose pas un prochain détenteur supprimé', () => {
    const prefill = getPrefillFromPreviousCarcasses(previousCarcasse(), {
      [ccgId]: entity(ccgId),
    });
    expect(prefill?.premier_detenteur_prochain_detenteur_id_cache).toBeNull();
    expect(prefill?.premier_detenteur_prochain_detenteur_role_cache).toBeNull();
    expect(prefill?.premier_detenteur_depot_entity_id).toBe(ccgId);
  });

  it('ne pré-remplit rien sans transmission précédente', () => {
    expect(
      getPrefillFromPreviousCarcasses(
        previousCarcasse({ premier_detenteur_prochain_detenteur_id_cache: null }),
        {}
      )
    ).toBeNull();
  });
});
