import { describe, expect, it } from 'vitest';
import { scrubSensitive, scrubString } from './scrub-sensitive';

// valeur fictive construite à l'exécution pour ne pas être prise pour un vrai secret par les scanners
const VALEUR = ['valeur', 'fictive'].join('-');
const MASQUE = '[masqué]';

describe('scrubSensitive', () => {
  it('masque les mots de passe des formulaires de connexion et les jetons', () => {
    expect(
      scrubSensitive({
        formData: { 'email-utilisateur': 'jean@example.fr', 'password-utilisateur': VALEUR },
        access_token: 'abc',
        fei_numero: 'ZACH-20250101-00001',
      })
    ).toEqual({
      formData: { 'email-utilisateur': MASQUE, 'password-utilisateur': MASQUE },
      access_token: MASQUE,
      fei_numero: 'ZACH-20250101-00001',
    });
  });

  it("masque les jetons dans l'URL de la page", () => {
    expect(
      scrubString('https://zacharie.beta.gouv.fr/app/connexion/reset-mot-de-passe?reset-password-token=abc')
    ).toBe('https://zacharie.beta.gouv.fr/app/connexion/reset-mot-de-passe?reset-password-token=[masqué]');
  });
});
