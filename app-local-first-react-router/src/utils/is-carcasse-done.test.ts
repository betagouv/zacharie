import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { Carcasse, CarcasseStatus, User } from '@prisma/client';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import {
  isCarcasseClosedBySvi,
  isCarcasseDone,
  isFeiDone,
  isCarcasseUnderMyResponsability,
  isCarcasseToTake,
} from './is-carcasse-done';

// Minimal carcasse factory — only the fields the "done / responsibility / to-take" logic reads.
// svi_carcasse_status defaults to SANS_DECISION (non-terminal) so the baseline carcasse is "not done".
function c(overrides: Partial<Carcasse> = {}): Carcasse {
  return {
    zacharie_carcasse_id: 'FEI-TEST_BR1',
    fei_numero: 'FEI-TEST',
    svi_closed_at: null,
    svi_automatic_closed_at: null,
    intermediaire_closed_at: null,
    intermediaire_carcasse_refus_intermediaire_id: null,
    intermediaire_carcasse_manquante: false,
    consommateur_final_usage_domestique: null,
    svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    current_owner_user_id: null,
    current_owner_entity_id: null,
    next_owner_user_id: null,
    next_owner_entity_id: null,
    next_owner_sous_traite_by_entity_id: null,
    ...overrides,
  } as unknown as Carcasse;
}

function fei(overrides: Partial<FeiWithIntermediaires> = {}): FeiWithIntermediaires {
  return {
    numero: 'FEI-TEST',
    intermediaire_closed_at: null,
    consommateur_final_usage_domestique: null,
    automatic_closed_at: null,
    ...overrides,
  } as unknown as FeiWithIntermediaires;
}

const me = { id: 'me' } as User;

// A key present (truthy value) means "an entity I work directly for".
function working(...ids: string[]): Record<string, EntityWithUserRelation> {
  return Object.fromEntries(ids.map((id) => [id, {} as EntityWithUserRelation]));
}
const noEntities: Record<string, EntityWithUserRelation> = {};

const TERMINAL_STATUSES: CarcasseStatus[] = [
  CarcasseStatus.ACCEPTE,
  CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
  CarcasseStatus.REFUS_ETG_COLLECTEUR,
  CarcasseStatus.MANQUANTE_SVI,
  CarcasseStatus.SAISIE_TOTALE,
  CarcasseStatus.SAISIE_PARTIELLE,
  CarcasseStatus.LEVEE_DE_CONSIGNE,
  CarcasseStatus.TRAITEMENT_ASSAINISSANT,
];

describe('isCarcasseClosedBySvi', () => {
  it('true when svi_closed_at is set', () => {
    expect(isCarcasseClosedBySvi(c({ svi_closed_at: new Date() }))).toBe(true);
  });

  it('true when svi_automatic_closed_at is set', () => {
    expect(isCarcasseClosedBySvi(c({ svi_automatic_closed_at: new Date() }))).toBe(true);
  });

  it('false otherwise — narrower than isCarcasseDone (ignores refus/manquante/intermediaire closures)', () => {
    expect(isCarcasseClosedBySvi(c({ intermediaire_closed_at: new Date() }))).toBe(false);
    expect(isCarcasseClosedBySvi(c({ intermediaire_carcasse_manquante: true }))).toBe(false);
    expect(isCarcasseClosedBySvi(c())).toBe(false);
  });
});

describe('isCarcasseDone', () => {
  it('true when SVI closed it (manual or cron)', () => {
    expect(isCarcasseDone(c({ svi_closed_at: new Date() }))).toBe(true);
    expect(isCarcasseDone(c({ svi_automatic_closed_at: new Date() }))).toBe(true);
  });

  it('true when closed by an intermediaire (circuit court / commerce de détail)', () => {
    expect(isCarcasseDone(c({ intermediaire_closed_at: new Date() }))).toBe(true);
  });

  it('true when refused or marked missing by an intermediaire', () => {
    expect(isCarcasseDone(c({ intermediaire_carcasse_refus_intermediaire_id: 'refus-id' }))).toBe(true);
    expect(isCarcasseDone(c({ intermediaire_carcasse_manquante: true }))).toBe(true);
  });

  it('true for domestic final-consumer usage', () => {
    expect(isCarcasseDone(c({ consommateur_final_usage_domestique: new Date() }))).toBe(true);
  });

  it.each(TERMINAL_STATUSES)('true for terminal svi_carcasse_status %s', (status) => {
    expect(isCarcasseDone(c({ svi_carcasse_status: status }))).toBe(true);
  });

  it.each([CarcasseStatus.CONSIGNE, CarcasseStatus.SANS_DECISION])(
    'false for non-terminal svi_carcasse_status %s',
    (status) => {
      expect(isCarcasseDone(c({ svi_carcasse_status: status }))).toBe(false);
    }
  );

  it('falls back to computed status when svi_carcasse_status is null — fresh assignment is not done', () => {
    // svi_carcasse_status null → updateCarcasseStatus runs; recently assigned, no IPM → SANS_DECISION (not terminal).
    expect(
      isCarcasseDone(
        c({
          svi_carcasse_status: null,
          svi_assigned_at: dayjs().subtract(1, 'day').toDate(),
        })
      )
    ).toBe(false);
  });

  it('falls back to computed status when svi_carcasse_status is null — 10+ days auto-accepts → done', () => {
    expect(
      isCarcasseDone(
        c({
          svi_carcasse_status: null,
          svi_assigned_at: dayjs().subtract(15, 'day').toDate(),
        })
      )
    ).toBe(true);
  });
});

describe('isFeiDone', () => {
  it('true when the fei was closed by an intermediaire', () => {
    expect(isFeiDone(fei({ intermediaire_closed_at: new Date() }), [c()])).toBe(true);
  });

  it('true for domestic final-consumer usage', () => {
    expect(isFeiDone(fei({ consommateur_final_usage_domestique: new Date() }), [c()])).toBe(true);
  });

  it('true when the fei was automatically closed', () => {
    expect(isFeiDone(fei({ automatic_closed_at: new Date() }), [c()])).toBe(true);
  });

  it('false when carcasses are not loaded yet — do not conclude done by vacuity', () => {
    expect(isFeiDone(fei(), [])).toBe(false);
  });

  it('true only when every carcasse is done', () => {
    const done = c({ svi_closed_at: new Date() });
    const ongoing = c();
    expect(isFeiDone(fei(), [done, ongoing])).toBe(false);
    expect(isFeiDone(fei(), [done, c({ intermediaire_closed_at: new Date() })])).toBe(true);
  });
});

describe('isCarcasseUnderMyResponsability', () => {
  it('false when there is a next owner — it is no longer mine to act on', () => {
    expect(
      isCarcasseUnderMyResponsability(
        c({ current_owner_user_id: 'me', next_owner_user_id: 'someone' }),
        me,
        noEntities
      )
    ).toBe(false);
    expect(
      isCarcasseUnderMyResponsability(
        c({ current_owner_user_id: 'me', next_owner_entity_id: 'entity' }),
        me,
        noEntities
      )
    ).toBe(false);
  });

  it('true when I am the current owner and there is no next owner', () => {
    expect(isCarcasseUnderMyResponsability(c({ current_owner_user_id: 'me' }), me, noEntities)).toBe(true);
  });

  it('true when the current owner entity is one I work directly for', () => {
    expect(isCarcasseUnderMyResponsability(c({ current_owner_entity_id: 'mine' }), me, working('mine'))).toBe(
      true
    );
  });

  it('false when the current owner entity is not mine', () => {
    expect(
      isCarcasseUnderMyResponsability(c({ current_owner_entity_id: 'other' }), me, working('mine'))
    ).toBe(false);
  });

  it('false when neither user nor entity match', () => {
    expect(isCarcasseUnderMyResponsability(c({ current_owner_user_id: 'someone' }), me, noEntities)).toBe(
      false
    );
  });
});

describe('isCarcasseToTake', () => {
  it('true when I am the next owner user', () => {
    expect(isCarcasseToTake(c({ next_owner_user_id: 'me' }), me, noEntities)).toBe(true);
  });

  it('true when the next owner entity is one I work directly for', () => {
    expect(isCarcasseToTake(c({ next_owner_entity_id: 'mine' }), me, working('mine'))).toBe(true);
  });

  it('false when the next owner entity is not mine', () => {
    expect(isCarcasseToTake(c({ next_owner_entity_id: 'other' }), me, working('mine'))).toBe(false);
  });

  it('false when there is no next owner pointing at me', () => {
    expect(isCarcasseToTake(c({ current_owner_user_id: 'me' }), me, noEntities)).toBe(false);
  });
});
