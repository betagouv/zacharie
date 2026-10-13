import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from './sanitize-redirect';

describe('sanitizeRedirect', () => {
  it("accepte les routes internes de l'app", () => {
    expect(sanitizeRedirect('/app')).toBe('/app');
    expect(sanitizeRedirect('/app/chasseur')).toBe('/app/chasseur');
    expect(sanitizeRedirect('/app/chasseur/fei/ZACH-123?tab=carcasses#top')).toBe(
      '/app/chasseur/fei/ZACH-123?tab=carcasses#top'
    );
    expect(sanitizeRedirect('/app/proconnect?redirect=%2Fapp%2Fadmin')).toBe(
      '/app/proconnect?redirect=%2Fapp%2Fadmin'
    );
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
  });
});
