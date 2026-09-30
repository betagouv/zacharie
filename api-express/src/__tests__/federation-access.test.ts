import { describe, test, expect } from 'vitest';
import { canAccessFederation, getAllFederationEntities } from '~/utils/federation-stats';

const federations = getAllFederationEntities();
const byId = (id: string) => {
  const federation = federations.find((f) => f.id === id);
  if (!federation) throw new Error(`Fédération ${id} introuvable`);
  return { scope_departements_codes: federation.scope_departements_codes as string[] };
};

const fnc = byId('federation-fnc');
const frcAura = byId('federation-frc-ARA');
const fdcAllier = byId('federation-fdc-03');
const fdcGironde = byId('federation-fdc-33');

describe('canAccessFederation', () => {
  test('la FNC accède à toutes les FDC', () => {
    expect(canAccessFederation(fnc, fdcAllier)).toBe(true);
    expect(canAccessFederation(fnc, fdcGironde)).toBe(true);
  });

  test('une FRC accède uniquement aux FDC de sa région', () => {
    expect(canAccessFederation(frcAura, fdcAllier)).toBe(true);
    expect(canAccessFederation(frcAura, fdcGironde)).toBe(false);
  });

  test("une FDC n'accède qu'à elle-même", () => {
    expect(canAccessFederation(fdcAllier, fdcAllier)).toBe(true);
    expect(canAccessFederation(fdcAllier, fdcGironde)).toBe(false);
    expect(canAccessFederation(fdcAllier, frcAura)).toBe(false);
    expect(canAccessFederation(fdcAllier, fnc)).toBe(false);
  });

  test("une FRC n'accède pas au tableau national", () => {
    expect(canAccessFederation(frcAura, fnc)).toBe(false);
  });

  test('une fédération sans département est inaccessible', () => {
    expect(canAccessFederation(fnc, { scope_departements_codes: [] })).toBe(false);
  });
});
