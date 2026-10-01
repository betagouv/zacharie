/**
 * Emails de notification trichine (fonctionnalité en TEST).
 * HTML en tables + styles inline pour la compatibilité clients mail (Gmail, Outlook, mobile).
 */

import type { TrichineResultatAnalyse } from '@prisma/client';

export const TRICHINE_EMAIL_CTA_URL = 'https://zacharie.beta.gouv.fr/app/laboratoire';
const CONTACT_EMAIL = 'contact@zacharie.beta.gouv.fr';

export const TRICHINE_RESULTAT_EMAIL_LABELS: Record<TrichineResultatAnalyse, string> = {
  NEGATIF: 'Négatif',
  DOUTEUX: 'Douteux',
  ANALYSE_IMPOSSIBLE: 'Analyse impossible',
  NON_NEGATIF: 'Parasite autre que la trichine',
  PRESENCE_PARASITE_NON_IDENTIFIE: 'Parasite non identifié',
  POSITIF: 'Positif (trichine confirmée)',
};

export type TrichineEmailTone = 'success' | 'warning' | 'danger' | 'info';

export type TrichineEmailContent = {
  /** Objet de l'email, sans préfixe (ajouté par buildTrichineEmail) */
  subject: string;
  tone: TrichineEmailTone;
  /** Libellé court du badge de statut, ex. « Résultat négatif » */
  badge: string;
  heading: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  actions: string[];
};

const TONES: Record<TrichineEmailTone, { color: string; background: string; border: string }> = {
  success: { color: '#18753c', background: '#b8fec9', border: '#18753c' },
  warning: { color: '#716043', background: '#feecc2', border: '#b34000' },
  danger: { color: '#ce0500', background: '#ffe9e9', border: '#ce0500' },
  info: { color: '#0063cb', background: '#e8edff', border: '#0063cb' },
};

const TEST_BANNER_TITLE = 'Fonctionnalité en test';
const TEST_BANNER_TEXT =
  'Le suivi trichine dans Zacharie est en phase d’expérimentation. Cette notification est envoyée à titre informatif : elle ne remplace pas les communications officielles du laboratoire ou des services vétérinaires. Signalez-nous toute anomalie.';

const FONT = "Marianne, Arial, 'Helvetica Neue', Helvetica, sans-serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildTrichineEmail(content: TrichineEmailContent): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[TEST] Trichine — ${content.subject}`;
  return { subject, html: renderHtml(content, subject), text: renderText(content) };
}

function renderText(content: TrichineEmailContent) {
  const lines = [
    `⚠ ${TEST_BANNER_TITLE.toUpperCase()}`,
    TEST_BANNER_TEXT,
    '',
    `[${content.badge}] ${content.heading}`,
    '',
    content.intro,
  ];
  if (content.details.length) {
    lines.push('', ...content.details.map((detail) => `• ${detail.label} : ${detail.value}`));
  }
  if (content.actions.length) {
    lines.push('', 'Ce que vous devez faire :', ...content.actions.map((action) => `→ ${action}`));
  }
  lines.push(
    '',
    `Ouvrir Zacharie : ${TRICHINE_EMAIL_CTA_URL}`,
    '',
    '—',
    'Zacharie, la traçabilité du gibier sauvage — beta.gouv.fr',
    `Une question, une anomalie ? Écrivez-nous à ${CONTACT_EMAIL}`
  );
  return lines.join('\n');
}

function renderHtml(content: TrichineEmailContent, subject: string) {
  const tone = TONES[content.tone];

  const detailsRows = content.details
    .map(
      (detail, index) => `
              <tr>
                <td style="padding:10px 16px;font-family:${FONT};font-size:14px;color:#666666;width:40%;${index ? 'border-top:1px solid #e5e5e5;' : ''}">${escapeHtml(detail.label)}</td>
                <td style="padding:10px 16px;font-family:${FONT};font-size:14px;color:#161616;font-weight:700;${index ? 'border-top:1px solid #e5e5e5;' : ''}">${escapeHtml(detail.value)}</td>
              </tr>`
    )
    .join('');

  const detailsBlock = content.details.length
    ? `
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f6;border-radius:4px;">${detailsRows}
              </table>
            </td>
          </tr>`
    : '';

  const actionsRows = content.actions
    .map(
      (action) => `
              <tr>
                <td valign="top" style="padding:4px 10px 4px 0;font-family:${FONT};font-size:15px;color:#000091;font-weight:700;width:14px;">→</td>
                <td style="padding:4px 0;font-family:${FONT};font-size:15px;line-height:22px;color:#161616;">${escapeHtml(action)}</td>
              </tr>`
    )
    .join('');

  const actionsBlock = content.actions.length
    ? `
          <tr>
            <td style="padding:0 32px 8px 32px;font-family:${FONT};font-size:16px;font-weight:700;color:#161616;">Ce que vous devez faire</td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">${actionsRows}
              </table>
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.heading)} — ${escapeHtml(content.intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dddddd;border-top:4px solid #000091;">
          <tr>
            <td style="padding:20px 32px;border-bottom:1px solid #e5e5e5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${FONT};font-size:11px;line-height:13px;font-weight:700;color:#161616;text-transform:uppercase;">République<br>Française</td>
                  <td align="right" style="font-family:${FONT};font-size:18px;font-weight:700;color:#000091;">Zacharie<br><span style="font-size:12px;font-weight:400;color:#666666;">Suivi trichine</span></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff4e5;border-left:4px solid #b34000;">
                <tr>
                  <td style="padding:12px 16px;font-family:${FONT};">
                    <div style="font-size:13px;font-weight:700;color:#b34000;text-transform:uppercase;letter-spacing:0.5px;">⚠ ${TEST_BANNER_TITLE}</div>
                    <div style="padding-top:4px;font-size:13px;line-height:19px;color:#3a3a3a;">${escapeHtml(TEST_BANNER_TEXT)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <span style="display:inline-block;padding:4px 10px;border-radius:4px;background:${tone.background};color:${tone.color};font-family:${FONT};font-size:12px;font-weight:700;text-transform:uppercase;">${escapeHtml(content.badge)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0 32px;font-family:${FONT};font-size:22px;line-height:28px;font-weight:700;color:#161616;">${escapeHtml(content.heading)}</td>
          </tr>
          <tr>
            <td style="padding:12px 32px 24px 32px;">
              <div style="border-left:4px solid ${tone.border};padding-left:14px;font-family:${FONT};font-size:15px;line-height:23px;color:#3a3a3a;">${escapeHtml(content.intro)}</div>
            </td>
          </tr>${detailsBlock}${actionsBlock}
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#000091;">
                    <a href="${TRICHINE_EMAIL_CTA_URL}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Ouvrir Zacharie</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f6f6f6;border-top:1px solid #e5e5e5;font-family:${FONT};font-size:12px;line-height:18px;color:#666666;">
              Zacharie, la traçabilité du gibier sauvage — un service <a href="https://beta.gouv.fr" style="color:#666666;">beta.gouv.fr</a><br>
              Une question, une anomalie ? Écrivez-nous à <a href="mailto:${CONTACT_EMAIL}" style="color:#000091;">${CONTACT_EMAIL}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
