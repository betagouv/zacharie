import { describe, it, expect, vi } from 'vitest';
import { UserRoles, type User } from '@prisma/client';

vi.mock('@app/zustand/user', () => ({ default: vi.fn() }));

import { getPostLoginRoute, getUserOnboardingRoute } from './user-onboarded.client';

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

const makeRoles = (roles: UserRoles[], fields: Partial<User> = {}) => makeUser({ roles, ...fields });

describe('getPostLoginRoute', () => {
  it("garde le redirect s'il appartient à l'espace de l'utilisateur", () => {
    expect(getPostLoginRoute(makeRoles([UserRoles.CHASSEUR]), '/app/chasseur/fei/X')).toBe(
      '/app/chasseur/fei/X'
    );
    expect(getPostLoginRoute(makeRoles([UserRoles.ETG]), '/app/etg/fei/X')).toBe('/app/etg/fei/X');
    expect(getPostLoginRoute(makeRoles([UserRoles.CHASSEUR]), '/app/nouvelle-fiche')).toBe(
      '/app/nouvelle-fiche'
    );
    expect(
      getPostLoginRoute(makeRoles([UserRoles.CHASSEUR], { isZacharieAdmin: true }), '/app/admin/users')
    ).toBe('/app/admin/users');
  });

  it("renvoie sur l'accueil du rôle si le redirect est d'un autre espace", () => {
    expect(getPostLoginRoute(makeRoles([UserRoles.ETG]), '/app/chasseur/fei/X')).toBe('/app/etg');
    expect(getPostLoginRoute(makeRoles([UserRoles.CHASSEUR]), '/app/admin/users')).toBe('/app/chasseur');
    expect(getPostLoginRoute(makeRoles([UserRoles.SVI]), '/app/circuit-court')).toBe('/app/svi');
    expect(getPostLoginRoute(makeRoles([UserRoles.COMMERCE_DE_DETAIL]), '/app/circuit-court/fei/X')).toBe(
      '/app/circuit-court/fei/X'
    );
  });

  it("renvoie sur l'accueil du rôle sans redirect valide", () => {
    expect(getPostLoginRoute(makeRoles([UserRoles.CHASSEUR]), null)).toBe('/app/chasseur');
    expect(getPostLoginRoute(makeRoles([UserRoles.CHASSEUR]), 'https://evil.example')).toBe('/app/chasseur');
  });
});
