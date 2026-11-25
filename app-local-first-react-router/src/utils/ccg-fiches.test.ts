import { describe, expect, it } from 'vitest';
import type { Carcasse, CarcasseIntermediaire, Fei } from '@prisma/client';
import { getCcgFiches } from './ccg-fiches';

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 8, minutes));

const fei = { numero: 'FEI-1', date_mise_a_mort: at(0), deleted_at: null } as unknown as Fei;

const carcasse = (id: string, extra: Partial<Carcasse> = {}) =>
  ({
    zacharie_carcasse_id: id,
    fei_numero: 'FEI-1',
    deleted_at: null,
    premier_detenteur_depot_entity_id: null,
    premier_detenteur_depot_ccg_at: null,
    ...extra,
  }) as unknown as Carcasse;

const intermediaire = (carcasseId: string, id: string, minutes: number, extra: Partial<CarcasseIntermediaire> = {}) =>
  ({
    zacharie_carcasse_id: carcasseId,
    fei_numero: 'FEI-1',
    intermediaire_id: id,
    intermediaire_entity_id: `entity-${id}`,
    created_at: at(minutes),
    prise_en_charge_at: at(minutes),
    intermediaire_depot_entity_id: null,
    deleted_at: null,
    ...extra,
  }) as unknown as CarcasseIntermediaire;

const empty = {
  feis: {},
  carcasses: {},
  carcassesIntermediaireById: {},
  ccgFeis: {},
  ccgCarcasses: {},
  ccgCarcassesIntermediaireById: {},
};

describe('getCcgFiches', () => {
  it('sans CCG : aucune fiche', () => {
    expect(getCcgFiches({ ...empty, ccgEntityIds: [], ccgFeis: { 'FEI-1': fei } })).toEqual([]);
  });

  it('dépôt par le premier détenteur : sortie par le premier intermédiaire', () => {
    const [fiche] = getCcgFiches({
      ...empty,
      ccgEntityIds: ['ccg-1'],
      ccgFeis: { 'FEI-1': fei },
      ccgCarcasses: {
        'FEI-1_B1': carcasse('FEI-1_B1', {
          premier_detenteur_depot_entity_id: 'ccg-1',
          premier_detenteur_depot_ccg_at: at(1),
        }),
      },
      ccgCarcassesIntermediaireById: { a: intermediaire('FEI-1_B1', 'collecteur', 20) },
    });
    expect(fiche.carcasses).toHaveLength(1);
    expect(fiche.carcasses[0].deposant).toBeNull();
    expect(fiche.carcasses[0].deposeAt).toEqual(at(1));
    expect(fiche.carcasses[0].sortie?.intermediaire_id).toBe('collecteur');
  });

  it('carcasse de mon périmètre déposée par un intermédiaire dans mon CCG', () => {
    const [fiche] = getCcgFiches({
      ...empty,
      ccgEntityIds: ['ccg-1'],
      feis: { 'FEI-1': fei },
      carcasses: { 'FEI-1_B1': carcasse('FEI-1_B1'), 'FEI-1_B2': carcasse('FEI-1_B2') },
      carcassesIntermediaireById: {
        a: intermediaire('FEI-1_B1', 'collecteur', 20, { intermediaire_depot_entity_id: 'ccg-1' }),
        b: intermediaire('FEI-1_B1', 'etg', 30),
        c: intermediaire('FEI-1_B2', 'collecteur', 20),
      },
    });
    expect(fiche.carcasses.map((view) => view.carcasse.zacharie_carcasse_id)).toEqual(['FEI-1_B1']);
    expect(fiche.carcasses[0].deposant?.intermediaire_id).toBe('collecteur');
    expect(fiche.carcasses[0].sortie?.intermediaire_id).toBe('etg');
  });

  it('la copie de mon périmètre l’emporte sur la copie CCG', () => {
    const fiches = getCcgFiches({
      ...empty,
      ccgEntityIds: ['ccg-1'],
      feis: { 'FEI-1': fei },
      carcasses: { 'FEI-1_B1': carcasse('FEI-1_B1', { premier_detenteur_depot_entity_id: 'ccg-1' }) },
      ccgCarcasses: { 'FEI-1_B1': carcasse('FEI-1_B1', { premier_detenteur_depot_entity_id: 'ccg-1' }) },
    });
    expect(fiches).toHaveLength(1);
    expect(fiches[0].carcasses).toHaveLength(1);
  });
});
