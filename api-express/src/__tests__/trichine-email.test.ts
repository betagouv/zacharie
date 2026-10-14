import { describe, test, expect } from 'vitest';
import {
  buildTrichineEmail,
  TRICHINE_EMAIL_CTA_URL,
  type TrichineEmailContent,
} from '~/templates/trichine-email';

const content: TrichineEmailContent = {
  subject: 'Résultat négatif · pool P-26-000012',
  tone: 'success',
  badge: 'Résultat négatif',
  heading: 'Pas de trichine détectée',
  intro: 'Le laboratoire n’a détecté aucune larve de trichine dans le pool P-26-000012.',
  details: [{ label: 'Pool', value: 'P-26-000012' }],
  actions: ['Les carcasses de ce pool peuvent être commercialisées.'],
};

describe('buildTrichineEmail', () => {
  test('préfixe l’objet avec [TEST] Trichine', () => {
    expect(buildTrichineEmail(content).subject).toBe('[TEST] Trichine — Résultat négatif · pool P-26-000012');
  });

  test('affiche le bandeau « fonctionnalité en test » en HTML et en texte', () => {
    const { html, text } = buildTrichineEmail(content);
    expect(html).toContain('Fonctionnalité en test');
    expect(text).toContain('FONCTIONNALITÉ EN TEST');
  });

  test('contient le contenu, les actions et le lien vers /app/laboratoire', () => {
    const { html, text } = buildTrichineEmail(content);
    expect(html).toContain('Pas de trichine détectée');
    expect(html).toContain('Ce que vous devez faire');
    expect(html).toContain(`href="${TRICHINE_EMAIL_CTA_URL}"`);
    expect(text).toContain(`Ouvrir Zacharie : ${TRICHINE_EMAIL_CTA_URL}`);
    expect(text).toContain('• Pool : P-26-000012');
  });

  test('échappe les valeurs saisies par les utilisateurs', () => {
    const { html } = buildTrichineEmail({
      ...content,
      details: [{ label: 'Motif du refus', value: '<script>alert(1)</script>' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('omet les blocs détails et actions quand ils sont vides', () => {
    const { html } = buildTrichineEmail({ ...content, details: [], actions: [] });
    expect(html).not.toContain('Ce que vous devez faire');
  });
});
