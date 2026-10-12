import { describe, it, expect, vi } from 'vitest';
import { UserRoles, type User } from '@prisma/client';

vi.mock('@app/zustand/user', () => ({ default: vi.fn() }));

import { getUserOnboardingRoute } from './user-onboarded.client';

const makeUser = (fields: Partial<User>) =>
  ({ onboarded_at: new Date(), isZacharieAdmin: false, ...fields }) as User;

describe('getUserOnboardingRoute', () => {
  it('renvoie le tableau de bord du rôle', () => {
    expect(getUserOnboardingRoute(makeUser({ roles: [UserRoles.CHASSEUR] }))).toBe('/app/chasseur');
    expect(getUserOnboardingRoute(makeUser({ roles: [UserRoles.COMMERCE_DE_DETAIL] }))).toBe(
      '/app/circuit-court'
    );
  });

  it("reconnaît un rôle circuit court qui n'est pas en première position", () => {
    expect(getUserOnboardingRoute(makeUser({ roles: [UserRoles.ADMIN, UserRoles.CONSOMMATEUR_FINAL] }))).toBe(
      '/app/circuit-court'
    );
  });

  it('renvoie /app/admin pour un admin Zacharie sans rôle métier', () => {
    expect(getUserOnboardingRoute(makeUser({ roles: [UserRoles.ADMIN], isZacharieAdmin: true }))).toBe(
      '/app/admin'
    );
  });

  it('ne plante pas pour un compte sans rôle reconnu', () => {
    expect(getUserOnboardingRoute(makeUser({ roles: [] }))).toBe('/');
    expect(getUserOnboardingRoute(makeUser({ roles: [UserRoles.ADMIN] }))).toBe('/');
  });
});
