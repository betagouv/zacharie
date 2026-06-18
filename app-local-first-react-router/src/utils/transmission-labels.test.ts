import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeiOwnerRole, UserRoles } from '@prisma/client';
import {
  RiCheckboxCircleLine,
  RiEdit2Line,
  RiTruckLine,
  RiDoorOpenLine,
  RiHourglassFill,
} from 'react-icons/ri';
import type { CarcasseTransmission } from '@app/types/carcasse';
import type { useEntitiesIdsWorkingDirectlyForObj } from '@app/utils/get-entity-relations';

// `@app/zustand/user` pulls in the whole IndexedDB/localStorage store chain (via circuit-court.ts),
// which we don't need here — stub it so the module graph stays light.
vi.mock('@app/zustand/user', () => ({ default: {} }));

const capture = vi.fn();
vi.mock('@app/services/sentry', () => ({ capture: (...args: unknown[]) => capture(...args) }));

import {
  getCurrentStepLabel,
  getCurrentStepLabelForChasseur,
  getCurrentStepLabelForEtg,
  getCurrentStepLabelForCollecteurPro,
  getNextStepLabel,
  getTransmissionLabels,
  getTransportOrSoustraiteLabel,
  IconStep,
} from './transmission-labels';

type EntitiesObj = ReturnType<typeof useEntitiesIdsWorkingDirectlyForObj>;

// Minimal transmission factory — only the fields the label logic reads.
function t(overrides: Partial<CarcasseTransmission> = {}): CarcasseTransmission {
  return { fei_numero: 'FEI-TEST', ...overrides } as CarcasseTransmission;
}

// Helper to fake "entity ids I work directly for". A key present (truthy value) means "mine".
function working(...ids: string[]): EntitiesObj {
  return Object.fromEntries(ids.map((id) => [id, {}])) as unknown as EntitiesObj;
}

const noEntities: EntitiesObj = {} as EntitiesObj;

beforeEach(() => {
  capture.mockClear();
});

describe('getCurrentStepLabel — dispatch by role', () => {
  it('returns "Clôturée" for circuit court roles regardless of status', () => {
    expect(getCurrentStepLabel('En cours', t(), UserRoles.COMMERCE_DE_DETAIL, noEntities)).toBe('Clôturée');
    expect(getCurrentStepLabel('À compléter', t(), UserRoles.CONSOMMATEUR_FINAL, noEntities)).toBe(
      'Clôturée'
    );
  });

  it('returns "Clôturée" for non-role-specific roles once the fiche is closed', () => {
    expect(getCurrentStepLabel('Clôturée', t(), UserRoles.SVI, noEntities)).toBe('Clôturée');
  });

  it('delegates to the chasseur label', () => {
    expect(
      getCurrentStepLabel(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR, next_owner_role: null }),
        UserRoles.CHASSEUR,
        noEntities
      )
    ).toBe('Validation par le premier détenteur');
  });

  it('delegates to the ETG label when in progress', () => {
    expect(
      getCurrentStepLabel('En cours', t({ svi_assigned_at: new Date() }), UserRoles.ETG, noEntities)
    ).toBe('Inspection par le SVI');
  });

  it('delegates to the collecteur pro label when in progress', () => {
    expect(
      getCurrentStepLabel(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.COLLECTEUR_PRO, next_owner_role: 'ETG' }),
        UserRoles.COLLECTEUR_PRO,
        noEntities
      )
    ).toBe('Transport vers un établissement de traitement');
  });

  it('returns the generic "En cours" for any other role', () => {
    expect(getCurrentStepLabel('En cours', t(), UserRoles.SVI, noEntities)).toBe('En cours');
  });

  it('captures the error and falls back to "En cours" when a label cannot be resolved', () => {
    // current not ETG, next ETG, but next entity is not mine → throws inside the ETG helper.
    const result = getCurrentStepLabel(
      'En cours',
      t({
        current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        next_owner_role: 'ETG',
        next_owner_entity_id: 'etg-not-mine',
      }),
      UserRoles.ETG,
      noEntities
    );
    expect(result).toBe('En cours');
    expect(capture).toHaveBeenCalledTimes(1);
    const [error, context] = capture.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((context as { tags: { role: string } }).tags.role).toBe('ETG');
  });
});

describe('getCurrentStepLabelForChasseur', () => {
  it('clôturée → carcasses traitées', () => {
    expect(getCurrentStepLabelForChasseur('Clôturée', t())).toBe('Carcasses traitées');
  });

  it('examinateur initial without next owner → information manquante', () => {
    expect(
      getCurrentStepLabelForChasseur(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL, next_owner_role: null })
      )
    ).toBe('Information manquante');
  });

  it('examinateur initial with next owner → validation par le premier détenteur', () => {
    expect(
      getCurrentStepLabelForChasseur(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL, next_owner_role: 'PREMIER_DETENTEUR' })
      )
    ).toBe('Validation par le premier détenteur');
  });

  it('premier détenteur without next owner → validation par le premier détenteur', () => {
    expect(
      getCurrentStepLabelForChasseur(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR, next_owner_role: null })
      )
    ).toBe('Validation par le premier détenteur');
  });

  it('premier détenteur with next owner → fiche envoyée, pas encore prise en charge', () => {
    expect(
      getCurrentStepLabelForChasseur(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR, next_owner_role: 'ETG' })
      )
    ).toBe('Fiche envoyée, pas encore prise en charge');
  });

  it('owned by collecteur pro → prise en charge par le transporteur', () => {
    expect(
      getCurrentStepLabelForChasseur('En cours', t({ current_owner_role: FeiOwnerRole.COLLECTEUR_PRO }))
    ).toBe('Prise en charge par le transporteur');
  });

  it('owned by anyone else (ETG) → traitement des carcasses', () => {
    expect(getCurrentStepLabelForChasseur('En cours', t({ current_owner_role: FeiOwnerRole.ETG }))).toBe(
      'Traitement des carcasses'
    );
  });
});

describe('getCurrentStepLabelForEtg', () => {
  it('clôturée with SVI assigned → inspection vétérinaire terminée', () => {
    expect(getCurrentStepLabelForEtg('Clôturée', t({ svi_assigned_at: new Date() }), noEntities)).toBe(
      'Inspection vétérinaire terminée'
    );
  });

  it('clôturée without SVI → carcasses refusées', () => {
    expect(getCurrentStepLabelForEtg('Clôturée', t({ svi_assigned_at: null }), noEntities)).toBe(
      'Carcasses refusées'
    );
  });

  it('SVI assigned → inspection par le SVI', () => {
    expect(getCurrentStepLabelForEtg('En cours', t({ svi_assigned_at: new Date() }), noEntities)).toBe(
      'Inspection par le SVI'
    );
  });

  it('owned by ETG, transferred to another ETG that is not mine → transport vers un autre établissement', () => {
    expect(
      getCurrentStepLabelForEtg(
        'En cours',
        t({ current_owner_role: 'ETG', next_owner_role: 'ETG', next_owner_entity_id: 'etg-other' }),
        noEntities
      )
    ).toBe('Transport vers un autre établissement de traitement');
  });

  it('owned by ETG, transferred to one of my ETGs → fiche reçue, pas encore prise en charge', () => {
    expect(
      getCurrentStepLabelForEtg(
        'En cours',
        t({ current_owner_role: 'ETG', next_owner_role: 'ETG', next_owner_entity_id: 'etg-mine' }),
        working('etg-mine')
      )
    ).toBe('Fiche reçue, pas encore prise en charge');
  });

  it("owned by one of my ETGs (no onward ETG transfer) → prise en charge par l'atelier", () => {
    expect(
      getCurrentStepLabelForEtg(
        'En cours',
        t({ current_owner_role: 'ETG', next_owner_role: null, current_owner_entity_id: 'etg-mine' }),
        working('etg-mine')
      )
    ).toBe("Prise en charge par l'atelier");
  });

  it('owned by an ETG that is not mine → prise en charge par un autre atelier', () => {
    expect(
      getCurrentStepLabelForEtg(
        'En cours',
        t({ current_owner_role: 'ETG', next_owner_role: null, current_owner_entity_id: 'etg-other' }),
        noEntities
      )
    ).toBe('Prise en charge par un autre atelier');
  });

  it('not yet owned by ETG but heading to one of my ETGs → fiche reçue, pas encore prise en charge', () => {
    expect(
      getCurrentStepLabelForEtg(
        'En cours',
        t({
          current_owner_role: FeiOwnerRole.COLLECTEUR_PRO,
          next_owner_role: 'ETG',
          next_owner_entity_id: 'etg-mine',
        }),
        working('etg-mine')
      )
    ).toBe('Fiche reçue, pas encore prise en charge');
  });

  it('heading to an ETG that is not mine, current not ETG → throws (unresolvable)', () => {
    expect(() =>
      getCurrentStepLabelForEtg(
        'En cours',
        t({
          current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
          next_owner_role: 'ETG',
          next_owner_entity_id: 'etg-other',
        }),
        noEntities
      )
    ).toThrow('No current step label for ETG next/role');
  });

  it('currently held by the transporter (collecteur pro), not heading to ETG → prise en charge par le transporteur', () => {
    expect(
      getCurrentStepLabelForEtg(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.COLLECTEUR_PRO, next_owner_role: null }),
        noEntities
      )
    ).toBe('Prise en charge par le transporteur');
  });

  it('no matching state → generic "En cours"', () => {
    expect(
      getCurrentStepLabelForEtg(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR }),
        noEntities
      )
    ).toBe('En cours');
  });
});

describe('getCurrentStepLabelForCollecteurPro', () => {
  it('clôturée → carcasses traitées', () => {
    expect(getCurrentStepLabelForCollecteurPro('Clôturée', t())).toBe('Carcasses traitées');
  });

  it('owned by collecteur, heading to ETG → transport vers un établissement de traitement', () => {
    expect(
      getCurrentStepLabelForCollecteurPro(
        'En cours',
        t({ current_owner_role: 'COLLECTEUR_PRO', next_owner_role: 'ETG' })
      )
    ).toBe('Transport vers un établissement de traitement');
  });

  it('owned by collecteur, not heading to ETG → transport', () => {
    expect(
      getCurrentStepLabelForCollecteurPro(
        'En cours',
        t({ current_owner_role: 'COLLECTEUR_PRO', next_owner_role: null })
      )
    ).toBe('Transport');
  });

  it('not yet owned but heading to a collecteur → fiche reçue, pas encore prise en charge', () => {
    expect(
      getCurrentStepLabelForCollecteurPro(
        'En cours',
        t({ current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR, next_owner_role: 'COLLECTEUR_PRO' })
      )
    ).toBe('Fiche reçue, pas encore prise en charge');
  });

  it('anything else → traitement des carcasses', () => {
    expect(getCurrentStepLabelForCollecteurPro('En cours', t({ current_owner_role: FeiOwnerRole.ETG }))).toBe(
      'Traitement des carcasses'
    );
  });
});

describe('getNextStepLabel', () => {
  it.each([
    ['Transport', 'Réception par un établissement de traitement'],
    ['Transport vers un établissement de traitement', 'Réception par un établissement de traitement'],
    ['Transport vers un autre établissement de traitement', 'Réception par un établissement de traitement'],
  ] as const)('%s → %s', (current, expected) => {
    expect(getNextStepLabel(current)).toBe(expected);
  });

  it('Information manquante → Validation par le premier détenteur', () => {
    expect(getNextStepLabel('Information manquante')).toBe('Validation par le premier détenteur');
  });

  it.each([
    'Fiche envoyée, pas encore prise en charge',
    'Prise en charge par un autre atelier',
    'Fiche reçue, pas encore prise en charge',
    'Prise en charge par le transporteur',
    "Prise en charge par l'atelier",
    'Validation par le premier détenteur',
  ] as const)('%s → Traitement des carcasses', (current) => {
    expect(getNextStepLabel(current)).toBe('Traitement des carcasses');
  });

  it.each([
    'Inspection vétérinaire terminée',
    'Carcasses traitées',
    'Inspection par le SVI',
    'Traitement des carcasses',
    'En cours',
    'Clôturée',
  ] as const)('%s → Clôturée', (current) => {
    expect(getNextStepLabel(current)).toBe('Clôturée');
  });
});

describe('IconStep', () => {
  it('closed fiche → checkbox circle icon', () => {
    expect(IconStep({ displayLabel: 'whatever', simpleStatus: 'Clôturée' }).type).toBe(RiCheckboxCircleLine);
  });

  it('information manquante → edit icon', () => {
    expect(IconStep({ displayLabel: 'Information manquante', simpleStatus: 'En cours' }).type).toBe(
      RiEdit2Line
    );
  });

  it('transport label → truck icon', () => {
    expect(IconStep({ displayLabel: 'Transport vers un ETG', simpleStatus: 'En cours' }).type).toBe(
      RiTruckLine
    );
  });

  it('atelier label → door icon', () => {
    expect(IconStep({ displayLabel: "Prise en charge par l'atelier", simpleStatus: 'En cours' }).type).toBe(
      RiDoorOpenLine
    );
  });

  it('anything else → hourglass icon', () => {
    expect(IconStep({ displayLabel: 'Traitement des carcasses', simpleStatus: 'En cours' }).type).toBe(
      RiHourglassFill
    );
  });
});

describe('getTransportOrSoustraiteLabel', () => {
  it('sous-traitée to one of my entities (I was not the previous/current owner) → Sous-traitée', () => {
    expect(
      getTransportOrSoustraiteLabel(
        t({
          next_owner_sous_traite_by_entity_id: 'sous-traitant-mine',
          prev_owner_entity_id: 'someone-else',
          current_owner_entity_id: 'another',
        }),
        working('sous-traitant-mine'),
        'Transport'
      )
    ).toBe('Sous-traitée');
  });

  it('sous-traitée by my own entity (I was the previous owner) → not flagged sous-traitée, falls through', () => {
    expect(
      getTransportOrSoustraiteLabel(
        t({
          next_owner_sous_traite_by_entity_id: 'sous-traitant-mine',
          prev_owner_entity_id: 'sous-traitant-mine',
        }),
        working('sous-traitant-mine'),
        'En cours'
      )
    ).toBe('');
  });

  it('sous-traitée by my own entity (I am the current owner) → falls through', () => {
    expect(
      getTransportOrSoustraiteLabel(
        t({
          next_owner_sous_traite_by_entity_id: 'sous-traitant-mine',
          current_owner_entity_id: 'sous-traitant-mine',
        }),
        working('sous-traitant-mine'),
        'En cours'
      )
    ).toBe('');
  });

  it('sous-traité to an entity that is not mine → ignored, falls through', () => {
    expect(
      getTransportOrSoustraiteLabel(
        t({ next_owner_sous_traite_by_entity_id: 'sous-traitant-other' }),
        noEntities,
        'En cours'
      )
    ).toBe('');
  });

  it('current step is Transport → Transporté', () => {
    expect(getTransportOrSoustraiteLabel(t(), noEntities, 'Transport')).toBe('Transporté');
  });

  it('no sous-traitance and not in transport → empty label', () => {
    expect(getTransportOrSoustraiteLabel(t(), noEntities, 'En cours')).toBe('');
  });
});

describe('getTransmissionLabels — orchestration', () => {
  it('returns the full label bundle', () => {
    const result = getTransmissionLabels(
      'En cours',
      t({ current_owner_role: 'COLLECTEUR_PRO', next_owner_role: 'ETG' }),
      UserRoles.COLLECTEUR_PRO,
      noEntities
    );
    expect(result).toEqual({
      simpleStatus: 'En cours',
      currentStepLabel: 'Transport vers un établissement de traitement',
      nextStepLabel: 'Réception par un établissement de traitement',
      transportOrSoustraiteLabel: '',
    });
  });
});
