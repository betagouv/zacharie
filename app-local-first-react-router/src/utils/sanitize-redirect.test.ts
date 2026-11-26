import { describe, expect, it } from 'vitest';
import { buildConnexionUrl, buildProConnectUrl, sanitizeRedirect } from './sanitize-redirect';

describe('sanitizeRedirect', () => {
  it("accepte les routes internes de l'app", () => {
    expect(sanitizeRedirect('/app')).toBe('/app');
    expect(sanitizeRedirect('/app/chasseur')).toBe('/app/chasseur');
    expect(sanitizeRedirect('/app/chasseur/fei/ZACH-123?tab=carcasses#top')).toBe(
      '/app/chasseur/fei/ZACH-123?tab=carcasses#top'
    );
  });

  it('aplatit un redirect imbriqué', () => {
    expect(sanitizeRedirect('/app/proconnect?redirect=%2Fapp%2Fadmin')).toBe('/app/admin');
    expect(
      sanitizeRedirect(
        '/app/proconnect?redirect=%2Fapp%2Fproconnect%3Fredirect%3D%252Fapp%252Fadmin%252Fusers'
      )
    ).toBe('/app/admin/users');
    expect(sanitizeRedirect('/app/connexion?redirect=%2Fapp%2Fetg')).toBe('/app/etg');
    expect(sanitizeRedirect('/app/chasseur/profil?redirect=%2Fapp%2Fchasseur%2Ffei%2FX&a=1')).toBe(
      '/app/chasseur/profil?a=1'
    );
    expect(sanitizeRedirect('/app/connexion')).toBeNull();
  });

  it('refuse les valeurs vides', () => {
    expect(sanitizeRedirect(null)).toBeNull();
    expect(sanitizeRedirect(undefined)).toBeNull();
    expect(sanitizeRedirect('')).toBeNull();
  });

  it('refuse les URLs externes ou dangereuses', () => {
    expect(sanitizeRedirect('https://evil.example')).toBeNull();
    expect(sanitizeRedirect('//evil.example')).toBeNull();
    expect(sanitizeRedirect('/\\evil.example')).toBeNull();
    expect(sanitizeRedirect('javascript:alert(1)')).toBeNull();
    expect(sanitizeRedirect('/application')).toBeNull();
    expect(sanitizeRedirect('/')).toBeNull();
    expect(sanitizeRedirect('app/chasseur')).toBeNull();
    expect(sanitizeRedirect('/app/\\evil.example')).toBeNull();
    expect(sanitizeRedirect('/app/\tchasseur')).toBeNull();
    expect(sanitizeRedirect('/app/\nchasseur')).toBeNull();
    expect(sanitizeRedirect('/app/../evil')).toBeNull();
    expect(sanitizeRedirect('/app/connexion?redirect=https%3A%2F%2Fevil.example')).toBeNull();
  });
});

describe('buildConnexionUrl / buildProConnectUrl', () => {
  it("n'imbrique jamais de redirect", () => {
    expect(buildConnexionUrl('/app/chasseur/fei/X')).toBe(
      '/app/connexion?redirect=%2Fapp%2Fchasseur%2Ffei%2FX'
    );
    expect(buildConnexionUrl('/app/connexion?redirect=%2Fapp%2Fetg')).toBe(
      '/app/connexion?redirect=%2Fapp%2Fetg'
    );
    expect(buildConnexionUrl('/')).toBe('/app/connexion');
    expect(buildProConnectUrl('/app/proconnect?redirect=%2Fapp%2Fadmin%2Fusers')).toBe(
      '/app/proconnect?redirect=%2Fapp%2Fadmin%2Fusers'
    );
    expect(buildProConnectUrl('/app/proconnect')).toBe('/app/proconnect?redirect=%2Fapp%2Fadmin');
  });
});
