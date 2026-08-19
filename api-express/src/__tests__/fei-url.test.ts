import { describe, test, expect } from 'vitest';
import { UserRoles } from '@prisma/client';
import { VITE_APP_URL } from '~/config';
import { getCircuitCourtFeiUrl, getFeiUrlForRole } from '~/utils/fei-url';

// `VITE_APP_URL` est l'origine du front (cf. `controllers/user.ts`, CORS) : le préfixe `/app` des
// routes applicatives est ajouté ici. Sans lui les liens tombent sur la page 404 du site vitrine.
const feiNumero = 'ZACH-TEST-001';
const prochainDetenteurIdCache = 'etg-1';

describe('getFeiUrlForRole', () => {
  test('préfixe toutes les URLs par /app/', () => {
    for (const role of [UserRoles.CHASSEUR, UserRoles.SVI, UserRoles.ETG, UserRoles.COLLECTEUR_PRO]) {
      const url = getFeiUrlForRole(role, feiNumero, prochainDetenteurIdCache);
      expect(url.startsWith(`${VITE_APP_URL}/app/`)).toBe(true);
    }
  });

  test('le chasseur consulte la fiche entière, sans prochain détenteur', () => {
    expect(getFeiUrlForRole(UserRoles.CHASSEUR, feiNumero, prochainDetenteurIdCache)).toBe(
      `${VITE_APP_URL}/app/chasseur/fei/${feiNumero}`
    );
  });

  test('les autres rôles consultent la transmission, avec le prochain détenteur', () => {
    expect(getFeiUrlForRole(UserRoles.SVI, feiNumero, prochainDetenteurIdCache)).toBe(
      `${VITE_APP_URL}/app/svi/fei/${feiNumero}/${prochainDetenteurIdCache}`
    );
    expect(getFeiUrlForRole(UserRoles.ETG, feiNumero, prochainDetenteurIdCache)).toBe(
      `${VITE_APP_URL}/app/etg/fei/${feiNumero}/${prochainDetenteurIdCache}`
    );
    expect(getFeiUrlForRole(UserRoles.COLLECTEUR_PRO, feiNumero, prochainDetenteurIdCache)).toBe(
      `${VITE_APP_URL}/app/collecteur-pro/fei/${feiNumero}/${prochainDetenteurIdCache}`
    );
  });

  test('throw sur un rôle sans espace fiche, plutôt que de construire une URL cassée', () => {
    expect(() => getFeiUrlForRole(undefined, feiNumero, prochainDetenteurIdCache)).toThrow();
    expect(() => getFeiUrlForRole(UserRoles.ADMIN, feiNumero, prochainDetenteurIdCache)).toThrow(
      /Unknown role/
    );
  });
});

describe('getCircuitCourtFeiUrl', () => {
  test('route passive du circuit court, préfixée par /app/', () => {
    expect(getCircuitCourtFeiUrl(feiNumero, 'commerce-1')).toBe(
      `${VITE_APP_URL}/app/circuit-court/fei/${feiNumero}/commerce-1`
    );
  });
});
