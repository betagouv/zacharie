// Forme canonique d'un numéro d'examinateur initial, commune à la liste officielle (import) et aux
// numéros saisis par les chasseurs, pour que la comparaison des deux soit une égalité stricte.
// - CFEI : `CFEI-<dép>-<AA>-<numéro>`, département sans zéro de tête (2 caractères minimum), numéro
//   sans zéro de tête. Le préfixe CFEI est ajouté s'il manque (cas de la liste du Var : `83-07-132`).
// - FREI (`<dép>-FREI-<AA>-<numéro>`) : gardé tel quel, seuls les séparateurs et la casse sont nettoyés.
// - Tout autre texte : tirets typographiques remplacés, espaces retirés, majuscules.

const TYPOGRAPHIC_DASHES = /[‐-―−]/g;
const SEPARATORS = /[\s_./]+/g;

const CFEI_PATTERN = /^(?:CFEI)?-?(\d{1,3}|0?2[AB])-(\d{2})-(\d+)$/;
const FREI_PATTERN = /^(\d{1,3}|0?2[AB])-?FREI-?(\d{2})-(\d+)$/;

function canonicalDepartement(departement: string) {
  return departement.replace(/^0+(?=.)/, '').padStart(2, '0');
}

export function canonicalNumeroCfei(source: string): string {
  const cleaned = source.replace(TYPOGRAPHIC_DASHES, '-').toUpperCase().trim();
  const tokens = cleaned.replace(SEPARATORS, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const cfei = tokens.match(CFEI_PATTERN);
  if (cfei) {
    const [, departement, annee, numero] = cfei;
    return `CFEI-${canonicalDepartement(departement)}-${annee}-${numero.replace(/^0+(?=.)/, '')}`;
  }

  const frei = tokens.match(FREI_PATTERN);
  if (frei) {
    const [, departement, annee, numero] = frei;
    return `${departement}-FREI-${annee}-${numero}`;
  }

  return cleaned.replace(/\s+/g, '');
}
