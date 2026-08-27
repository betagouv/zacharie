import xss from 'xss';

export function sanitize(source: string) {
  return xss(source, {
    whiteList: {}, // empty, means filter out all tags
    stripIgnoreTag: true, // filter out all HTML not in the whilelist
    stripIgnoreTagBody: ['script'], // the script tag is a special case, we need
    // to filter out its content
  });
}

// Brevo fait passer le sujet, le HTML et le texte de ses emails transactionnels dans son propre
// moteur de template : `{{ ... }}` et `{% ... %}` sont évalués chez Brevo, après notre envoi.
// Aucun email construit dans le code n'utilise ces placeholders (les templates Brevo, eux, reçoivent
// leurs valeurs via `params`), donc on casse le délimiteur en insérant une espace : le texte saisi
// s'affiche tel quel et rien n'est interprété.
export function escapeBrevoPlaceholders(source: string) {
  return source.replace(/\{(?=[{%])/g, '{ ');
}

// Le numéro CFEI est nullable : un champ laissé vide (ou envoyé à null par le front) doit être
// stocké en null, jamais en chaîne vide, sinon il compte comme un changement de numéro.
export function normalizeNumeroCfei(source: string | null | undefined) {
  if (!source) return null;
  return sanitize(source).trim() || null;
}
