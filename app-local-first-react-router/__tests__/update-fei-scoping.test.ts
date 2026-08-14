import 'fake-indexeddb/auto';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { FeiOwnerRole } from '@prisma/client';
import type { Carcasse, Fei } from '@prisma/client';

import useZustandStore from '../src/zustand/store';

vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));

const FEI_NUMERO = 'ZACH-TEST-SCOPING';

function makeFei(overrides: Partial<Fei> = {}): Fei {
  return {
    numero: FEI_NUMERO,
    date_mise_a_mort: new Date('2026-05-22T00:00:00.000Z'),
    heure_mise_a_mort_premiere_carcasse: '08:00',
    heure_evisceration_derniere_carcasse: '09:00',
    examinateur_initial_user_id: 'EXAM-1',
    premier_detenteur_user_id: 'EXAM-1',
    premier_detenteur_entity_id: null,
    updated_at: new Date('2026-05-22T10:00:00.000Z'),
    ...overrides,
  } as unknown as Fei;
}

function makeCarcasse(id: string, overrides: Partial<Carcasse> = {}): Carcasse {
  return {
    zacharie_carcasse_id: id,
    numero_bracelet: id,
    fei_numero: FEI_NUMERO,
    date_mise_a_mort: new Date('2026-05-22T00:00:00.000Z'),
    heure_mise_a_mort_premiere_carcasse_fei: '08:00',
    examinateur_initial_user_id: 'EXAM-1',
    current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
    next_owner_entity_id: null,
    is_synced: true,
    updated_at: new Date('2026-05-22T10:00:00.000Z'),
    ...overrides,
  } as unknown as Carcasse;
}

describe('updateFei ne réécrit que les carcasses encore chez le chasseur', () => {
  beforeEach(() => {
    useZustandStore.setState({
      feis: { [FEI_NUMERO]: makeFei() },
      carcasses: {
        // encore chez le chasseur
        RESTANTE: makeCarcasse('RESTANTE'),
        // destinataire choisi, pas encore prise en charge
        ENVOYEE: makeCarcasse('ENVOYEE', { next_owner_entity_id: 'ETG-1' }),
        // prise en charge par l'ETG
        CHEZ_ETG: makeCarcasse('CHEZ_ETG', {
          current_owner_role: FeiOwnerRole.ETG,
          current_owner_entity_id: 'ETG-1',
        }),
      },
    });
  });

  // Régression : createCarcasse appelle updateFei, qui repassait TOUTES les carcasses de la fiche
  // en is_synced=false. Le /sync repoussait alors les carcasses prises en charge par l'aval,
  // entières, depuis le snapshot local du chasseur — et syncCarcasse applique le body sans comparer
  // updated_at, donc le snapshot périmé écrasait la prise en charge.
  test('les carcasses prises en charge en aval ne sont pas remises en file de synchronisation', () => {
    useZustandStore.getState().updateFei(FEI_NUMERO, { commune_mise_a_mort: 'CHASSENARD' });

    const { carcasses } = useZustandStore.getState();
    expect(carcasses.RESTANTE.is_synced).toBe(false);
    expect(carcasses.CHEZ_ETG.is_synced).toBe(true);
  });

  // La frontière est la prise en charge, pas le choix du destinataire : tant que l'ETG n'a pas pris
  // en charge, le chasseur reste détenteur courant, peut encore corriger la fiche, et ces
  // corrections doivent bien redescendre sur la carcasse.
  test('une carcasse transmise mais pas encore prise en charge suit toujours la fiche', () => {
    useZustandStore.getState().updateFei(FEI_NUMERO, { heure_mise_a_mort_premiere_carcasse: '07:15' });

    const { carcasses } = useZustandStore.getState();
    expect(carcasses.ENVOYEE.is_synced).toBe(false);
    expect(carcasses.ENVOYEE.heure_mise_a_mort_premiere_carcasse_fei).toBe('07:15');
  });

  test("l'ownership d'une carcasse prise en charge est laissé intact", () => {
    useZustandStore.getState().updateFei(FEI_NUMERO, { commune_mise_a_mort: 'CHASSENARD' });

    const { carcasses } = useZustandStore.getState();
    expect(carcasses.CHEZ_ETG.current_owner_role).toBe(FeiOwnerRole.ETG);
    expect(carcasses.CHEZ_ETG.current_owner_entity_id).toBe('ETG-1');
    expect(carcasses.ENVOYEE.next_owner_entity_id).toBe('ETG-1');
  });

  test('les champs de fiche sont bien propagés aux carcasses restantes', () => {
    useZustandStore.getState().updateFei(FEI_NUMERO, { heure_mise_a_mort_premiere_carcasse: '07:15' });

    const { carcasses } = useZustandStore.getState();
    expect(carcasses.RESTANTE.heure_mise_a_mort_premiere_carcasse_fei).toBe('07:15');
    expect(carcasses.CHEZ_ETG.heure_mise_a_mort_premiere_carcasse_fei).toBe('08:00');
  });
});
