import { describe, expect, it } from 'vitest';
import { sanitizeAppRedirect } from '~/utils/sanitize-redirect';

describe('sanitizeAppRedirect', () => {
  it("accepte les routes internes de l'app", () => {
    expect(sanitizeAppRedirect('/app/admin/users')).toBe('/app/admin/users');
    expect(sanitizeAppRedirect('/app/admin/users?q=x')).toBe('/app/admin/users?q=x');
  });

  it('aplatit un redirect imbriqué', () => {
    expect(sanitizeAppRedirect('/app/proconnect?redirect=%2Fapp%2Fadmin%2Fusers')).toBe('/app/admin/users');
    expect(
      sanitizeAppRedirect(
        '/app/proconnect?redirect=%2Fapp%2Fconnexion%3Fredirect%3D%252Fapp%252Fadmin%252Fentities'
      )
    ).toBe('/app/admin/entities');
    expect(sanitizeAppRedirect('/app/admin/users?redirect=%2Fapp%2Fchasseur&q=x')).toBe(
      '/app/admin/users?q=x'
    );
  });

  it('refuse les valeurs invalides', () => {
    expect(sanitizeAppRedirect(undefined)).toBeNull();
    expect(sanitizeAppRedirect(['/app/admin'])).toBeNull();
    expect(sanitizeAppRedirect('https://evil.example')).toBeNull();
    expect(sanitizeAppRedirect('//evil.example')).toBeNull();
    expect(sanitizeAppRedirect('/app/../evil')).toBeNull();
    expect(sanitizeAppRedirect('/app/proconnect')).toBeNull();
    expect(sanitizeAppRedirect('/app/proconnect?redirect=https%3A%2F%2Fevil.example')).toBeNull();
  });
});
