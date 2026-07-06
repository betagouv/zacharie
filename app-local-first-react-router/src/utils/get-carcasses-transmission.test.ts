import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Carcasse } from '@prisma/client';
import type { CarcasseTransmission } from '@app/types/carcasse';
import { capture } from '@app/services/sentry';
import { checkCarcasseAgainstTransmission, getCarcasseTransmission } from './get-carcasses-transmission';

// checkCarcasseAgainstTransmission reports (via Sentry `capture`) when two carcasses of the SAME
// transmission diverge on a field that should be identical across the lot. Some divergences are
// legitimate (a carcasse added via RequestNewCarcasseForm, a refused carcasse leaving the circuit)
// and must NOT be reported. We mock `capture` and assert exactly whether it fired.
vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));
const mockedCapture = vi.mocked(capture);

beforeEach(() => mockedCapture.mockClear());

// Shared Date instances so equal date fields compare `===` (a fresh `new Date()` per carcasse would
// look like a divergence). Override with a *different* instance to simulate a real divergence.
const D_MORT = new Date('2024-01-01T00:00:00.000Z');
const D_APPRO = new Date('2024-02-01T00:00:00.000Z');
const D_META = new Date('2024-02-02T00:00:00.000Z');

// A carcasse already approved and in transit towards an ETG — every field getCarcasseTransmission
// reads is present so the comparison exercises the real key set.
const BASE = {
  fei_numero: 'FEI-1',
  date_mise_a_mort: D_MORT,
  consommateur_final_usage_domestique: null,
  is_synced: true,
  created_at: D_META,
  updated_at: D_META,
  created_by_user_id: 'examinateur-1',
  examinateur_initial_user_id: 'examinateur-1',
  examinateur_initial_approbation_mise_sur_le_marche: true,
  examinateur_initial_date_approbation_mise_sur_le_marche: D_APPRO,
  premier_detenteur_user_id: 'pd-1',
  premier_detenteur_offline: false,
  premier_detenteur_entity_id: null,
  premier_detenteur_name_cache: 'PD Un',
  premier_detenteur_depot_type: null,
  premier_detenteur_depot_entity_id: null,
  premier_detenteur_depot_entity_name_cache: null,
  premier_detenteur_depot_ccg_at: null,
  premier_detenteur_transport_type: null,
  premier_detenteur_transport_date: null,
  premier_detenteur_prochain_detenteur_role_cache: 'ETG',
  premier_detenteur_prochain_detenteur_id_cache: 'etg-entity-1',
  intermediaire_carcasse_refus_intermediaire_id: null,
  intermediaire_carcasse_refus_motif: null,
  intermediaire_carcasse_manquante: false,
  intermediaire_closed_at: null,
  intermediaire_closed_by_user_id: null,
  intermediaire_closed_by_entity_id: null,
  latest_intermediaire_signed_at: null,
  latest_intermediaire_user_id: null,
  latest_intermediaire_entity_id: null,
  latest_intermediaire_name_cache: null,
  svi_assigned_at: null,
  svi_entity_id: null,
  svi_user_id: null,
  svi_closed_at: null,
  svi_automatic_closed_at: null,
  svi_closed_by_user_id: null,
  current_owner_user_id: null,
  current_owner_user_name_cache: null,
  current_owner_entity_id: 'etg-entity-1',
  current_owner_entity_name_cache: 'ETG Un',
  current_owner_role: 'ETG',
  next_owner_wants_to_sous_traite: null,
  next_owner_sous_traite_at: null,
  next_owner_sous_traite_by_user_id: null,
  next_owner_sous_traite_by_entity_id: null,
  next_owner_user_id: null,
  next_owner_user_name_cache: null,
  next_owner_entity_id: null,
  next_owner_entity_name_cache: null,
  next_owner_role: null,
  prev_owner_user_id: null,
  prev_owner_entity_id: null,
  prev_owner_role: null,
} as unknown as Carcasse;

function carc(overrides: Partial<Carcasse> = {}): Carcasse {
  return { ...BASE, ...overrides } as unknown as Carcasse;
}

// Mirror the real caller (useGetTransmissionFromTransmissionId): the transmission is derived from
// the reference carcasse, and every carcasse of the lot is checked against it.
function check(ref: Carcasse, carcasse: Carcasse) {
  const transmission = getCarcasseTransmission(ref);
  const keys = Object.keys(transmission) as Array<keyof CarcasseTransmission>;
  checkCarcasseAgainstTransmission(keys, transmission, carcasse, ref);
}

function differKeys(): string[] {
  const ctx = mockedCapture.mock.calls[0][1] as { extra: { differ: Record<string, unknown> } };
  return Object.keys(ctx.extra.differ);
}

// ---------------------------------------------------------------------------
// A. capture must stay silent — legitimate divergences
// ---------------------------------------------------------------------------

describe('checkCarcasseAgainstTransmission — silent (no false positive)', () => {
  it('identical carcasses never report', () => {
    check(carc(), carc());
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it('a carcasse added via RequestNewCarcasseForm (different created_by_user_id) does not report', () => {
    check(carc(), carc({ created_by_user_id: 'etg-user-1' }));
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it('pending requested carcasse (approbation not yet given) does not report', () => {
    check(carc(), carc({ examinateur_initial_approbation_mise_sur_le_marche: null }));
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it('requested carcasse approved later (different approbation date) does not report', () => {
    check(carc(), carc({ examinateur_initial_date_approbation_mise_sur_le_marche: new Date('2024-05-05') }));
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it('full RequestNewCarcasseForm signature (created_by + approbation + approbation date) does not report', () => {
    check(
      carc(),
      carc({
        created_by_user_id: 'etg-user-1',
        examinateur_initial_approbation_mise_sur_le_marche: true,
        examinateur_initial_date_approbation_mise_sur_le_marche: new Date('2024-05-05'),
      })
    );
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it('per-carcasse technical metadata (created_at / updated_at / is_synced) never reports', () => {
    check(
      carc(),
      carc({ created_at: new Date('2024-09-09'), updated_at: new Date('2024-09-09'), is_synced: false })
    );
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it('a refused carcasse leaving the circuit (downstream owner differs) does not report', () => {
    // The refused carcasse legitimately diverges on next_owner_* because it exits the flow.
    check(
      carc(),
      carc({
        intermediaire_carcasse_refus_intermediaire_id: 'refus-1',
        intermediaire_carcasse_refus_motif: 'Saisie',
        next_owner_entity_id: 'someone-else',
        next_owner_role: 'SVI',
      })
    );
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it('a missing carcasse (manquante) with divergent downstream owner does not report', () => {
    check(carc(), carc({ intermediaire_carcasse_manquante: true, next_owner_entity_id: 'someone-else' }));
    expect(mockedCapture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// B. capture must fire — real divergences
// ---------------------------------------------------------------------------

describe('checkCarcasseAgainstTransmission — reports (real divergence)', () => {
  it('an always-same field (date_mise_a_mort) diverging reports', () => {
    check(carc(), carc({ date_mise_a_mort: new Date('2024-12-31') }));
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(mockedCapture).toHaveBeenCalledWith(
      'Transmssion differs from one of the carcasses',
      expect.anything()
    );
    expect(differKeys()).toContain('date_mise_a_mort');
  });

  it('an always-same owner cache (premier_detenteur_entity_id) diverging reports', () => {
    check(carc(), carc({ premier_detenteur_entity_id: 'other-entity' }));
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(differKeys()).toContain('premier_detenteur_entity_id');
  });

  it('an unexpected downstream divergence with NO refusal reason reports', () => {
    check(carc(), carc({ next_owner_entity_id: 'unexpected-entity' }));
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(differKeys()).toContain('next_owner_entity_id');
  });

  it('a refused carcasse still reports when an always-same field also diverges', () => {
    // Refusal alone would be silenced, but a genuine always-same divergence (date_mise_a_mort)
    // overrides that: shouldNOTdifferButDiffer wins and we report.
    check(
      carc(),
      carc({
        intermediaire_carcasse_refus_intermediaire_id: 'refus-1',
        next_owner_entity_id: 'someone-else',
        date_mise_a_mort: new Date('2024-12-31'),
      })
    );
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(differKeys()).toContain('date_mise_a_mort');
  });
});
