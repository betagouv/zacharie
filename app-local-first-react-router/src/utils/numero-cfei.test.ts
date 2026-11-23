import { describe, expect, it } from 'vitest';
import { isNumeroCfeiHorsFormat, isNumeroCfeiValide } from './numero-cfei';

describe('isNumeroCfeiValide', () => {
  it.each(['CFEI-075-25-001', 'CFEI-03-24-12', 'cfei-2a-25-001', 'CFEI-2B-24-1', '  CFEI-971-25-7  '])(
    'accepte %s',
    (numero) => {
      expect(isNumeroCfeiValide(numero)).toBe(true);
    }
  );

  it.each([
    '123',
    'CFEI-075-2025-001',
    '075-FREI-25-001',
    'CFEI-075-25',
    'CFEI-075-25-ABC',
    'CFEI 075 25 001',
    'CFEI-2C-25-001',
    'CFEI-0750-25-001',
    'XCFEI-075-25-001',
  ])('refuse %s', (numero) => {
    expect(isNumeroCfeiValide(numero)).toBe(false);
  });
});

describe('isNumeroCfeiHorsFormat', () => {
  it("n'avertit pas sur un champ vide", () => {
    expect(isNumeroCfeiHorsFormat('')).toBe(false);
    expect(isNumeroCfeiHorsFormat('   ')).toBe(false);
  });

  it('avertit sur un numéro saisi hors format', () => {
    expect(isNumeroCfeiHorsFormat('123')).toBe(true);
    expect(isNumeroCfeiHorsFormat('CFEI-075-25-001')).toBe(false);
  });
});
