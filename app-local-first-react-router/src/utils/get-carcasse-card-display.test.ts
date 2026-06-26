import { describe, it, expect } from 'vitest';
import { Carcasse, CarcasseStatus, CarcasseType, FeiOwnerRole } from '@prisma/client';
import { deriveCarcasseUiState, getCarcasseCardDisplay } from './get-carcasse-card-display';

// Minimal carcasse factory — only the fields the ui-state logic reads.
function c(overrides: Partial<Carcasse> = {}): Carcasse {
  return {
    zacharie_carcasse_id: 'FEI-TEST_MM-001-001',
    fei_numero: 'FEI-TEST',
    type: CarcasseType.GROS_GIBIER,
    svi_ipm1_date: null,
    svi_ipm2_date: null,
    svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    current_owner_role: null,
    next_owner_role: null,
    ...overrides,
  } as unknown as Carcasse;
}

const noEntities = {} as Parameters<typeof getCarcasseCardDisplay>[0]['entities'];

describe('deriveCarcasseUiState — possession lue au niveau carcasse', () => {
  it('carcasse encore chez le premier détenteur sans prochain détenteur → "creation"', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      next_owner_role: null,
    });
    expect(deriveCarcasseUiState(carcasse, undefined, {})).toBe('creation');
  });

  it('carcasse chez l\'examinateur initial sans prochain détenteur → "creation"', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
      next_owner_role: null,
    });
    expect(deriveCarcasseUiState(carcasse, undefined, {})).toBe('creation');
  });

  it('carcasse transmise à un ETG (next_owner = ETG) → "transmise"', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      next_owner_role: FeiOwnerRole.ETG,
    });
    expect(deriveCarcasseUiState(carcasse, undefined, {})).toBe('transmise');
  });

  // Circuit court (commerce de détail, particulier…) est un destinataire terminal :
  // la carcasse est « Transmise », pas « en cours de traitement ».
  it('carcasse transmise à un destinataire de circuit court → "transmise-circuit-court"', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.COMMERCE_DE_DETAIL,
      next_owner_role: null,
    });
    expect(deriveCarcasseUiState(carcasse, undefined, {})).toBe('transmise-circuit-court');
  });

  // Régression : après un « Retour à l'envoyeur » d'un ETG, seul next_owner_role de la
  // carcasse repasse à null. La carte doit lire la carcasse (et non le snapshot FEI périmé)
  // → l'état repasse à "creation", actionnable, et non "transmise".
  it('carcasse renvoyée par l\'ETG (next_owner repassé à null) → "creation"', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      next_owner_role: null,
    });
    expect(deriveCarcasseUiState(carcasse, undefined, {})).toBe('creation');
  });
});

describe('getCarcasseCardDisplay — vue chasseur', () => {
  it('carcasse transmise → libellé "En cours de traitement"', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      next_owner_role: FeiOwnerRole.ETG,
    });
    const display = getCarcasseCardDisplay({
      carcasse,
      latestIntermediaire: undefined,
      entities: noEntities,
      viewRole: 'chasseur',
    });
    expect(display.uiState).toBe('transmise');
    expect(display.statusLabel).toBe('En cours de traitement');
  });

  it('carcasse transmise en circuit court → libellé "Transmise" (vert)', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.COMMERCE_DE_DETAIL,
      next_owner_role: null,
    });
    const display = getCarcasseCardDisplay({
      carcasse,
      latestIntermediaire: undefined,
      entities: noEntities,
      viewRole: 'chasseur',
    });
    expect(display.uiState).toBe('transmise-circuit-court');
    expect(display.statusLabel).toBe('Transmise');
    expect(display.accentColor).toBe('green');
  });

  it('carcasse renvoyée par l\'ETG → plus de "En cours de traitement"', () => {
    const carcasse = c({
      current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      next_owner_role: null,
    });
    const display = getCarcasseCardDisplay({
      carcasse,
      latestIntermediaire: undefined,
      entities: noEntities,
      viewRole: 'chasseur',
    });
    expect(display.uiState).toBe('creation');
    expect(display.statusLabel).toBeNull();
  });
});
