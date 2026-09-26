import { describe, test, expect } from 'vitest';
import { scrubSensitive, scrubString } from '~/utils/scrub-sensitive';

// valeurs fictives construites à l'exécution pour ne pas être prises pour de vrais secrets par les scanners
const VALEUR = ['valeur', 'fictive'].join('-');
const MASQUE = '[masqué]';
const JWT_FICTIF = ['eyJhbGciOiJIUzI1NiJ9', 'eyJ1c2VySWQiOiIxIn0', 'sig_nature'].join('.');

describe('scrubSensitive', () => {
  test('masque les mots de passe et jetons, quel que soit le nom du champ et la profondeur', () => {
    const scrubbed = scrubSensitive({
      body: {
        passwordUser: VALEUR,
        'password-utilisateur': VALEUR,
        currentPassword: VALEUR,
        newPassword: VALEUR,
        resetPasswordToken: 'c',
        invitationToken: 'd',
        accessToken: 'e',
        access_token: 'f',
        token: 'g',
      },
      headers: { cookie: 'zacharie_express_jwt=abc', authorization: 'Bearer abc', 'x-api-key': 'k' },
      user: { web_push_tokens: ['x'], native_push_tokens: ['y'] },
    });
    expect(scrubbed).toEqual({
      body: {
        passwordUser: MASQUE,
        'password-utilisateur': MASQUE,
        currentPassword: MASQUE,
        newPassword: MASQUE,
        resetPasswordToken: MASQUE,
        invitationToken: MASQUE,
        accessToken: MASQUE,
        access_token: MASQUE,
        token: MASQUE,
      },
      headers: { cookie: MASQUE, authorization: MASQUE, 'x-api-key': MASQUE },
      user: { web_push_tokens: MASQUE, native_push_tokens: MASQUE },
    });
  });

  test('masque les données personnelles et garde les identifiants et champs métier', () => {
    const scrubbed = scrubSensitive({
      id: 'user-1',
      email: 'jean@example.fr',
      telephone: '0612345678',
      addresse_ligne_1: '1 rue des Bois',
      prenom: 'Jean',
      nom_de_famille: 'Dupont',
      premier_detenteur_name_cache: 'Jean Dupont',
      roles: ['CHASSEUR'],
      fei_numero: 'ZACH-20250101-00001',
      originalUrl: '/fei/ZACH-20250101-00001',
      examinateur_initial_user_id: 'user-1',
    });
    expect(scrubbed).toEqual({
      id: 'user-1',
      email: MASQUE,
      telephone: MASQUE,
      addresse_ligne_1: MASQUE,
      prenom: MASQUE,
      nom_de_famille: MASQUE,
      premier_detenteur_name_cache: MASQUE,
      roles: ['CHASSEUR'],
      fei_numero: 'ZACH-20250101-00001',
      originalUrl: '/fei/ZACH-20250101-00001',
      examinateur_initial_user_id: 'user-1',
    });
  });

  test('supporte les cycles et les objets référencés plusieurs fois', () => {
    const shared = { id: 'a' };
    const cyclic: Record<string, unknown> = { shared, again: shared };
    cyclic.self = cyclic;
    expect(scrubSensitive(cyclic)).toEqual({ shared: { id: 'a' }, again: { id: 'a' }, self: MASQUE });
  });
});

describe('scrubString', () => {
  test("masque les jetons dans les URL sans perdre l'URL", () => {
    expect(
      scrubString(
        'https://zacharie.beta.gouv.fr/app/connexion/reset-mot-de-passe?reset-password-token=abc123'
      )
    ).toBe('https://zacharie.beta.gouv.fr/app/connexion/reset-mot-de-passe?reset-password-token=[masqué]');
    expect(scrubString('/app/connexion/invitation?invitation-token=abc&email=jean%40example.fr&x=1')).toBe(
      '/app/connexion/invitation?invitation-token=[masqué]&email=[masqué]&x=1'
    );
    expect(scrubString('/app/nouvelle-fiche?access_token=abc&date_mise_a_mort=2025-01-01')).toBe(
      '/app/nouvelle-fiche?access_token=[masqué]&date_mise_a_mort=2025-01-01'
    );
  });

  test('masque les JWT, en-têtes Bearer, jetons push Expo et adresses e-mail dans du texte libre', () => {
    expect(scrubString('Authorization: Bearer abc.def-ghi')).toBe('Authorization: Bearer [masqué]');
    expect(scrubString(`jwt ${JWT_FICTIF}`)).toBe('jwt [masqué]');
    expect(scrubString('ExponentPushToken[xxxx] is not registered')).toBe('[masqué] is not registered');
    expect(scrubString('Nouvelle ouverture de compte pour jean.dupont@example.fr')).toBe(
      'Nouvelle ouverture de compte pour [masqué]'
    );
  });
});
