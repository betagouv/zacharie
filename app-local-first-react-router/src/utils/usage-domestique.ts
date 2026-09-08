// Le premier détenteur peut garder des carcasses pour son usage domestique privé : elles ne partent
// chez personne, mais leur sort est réglé. Partout où les carcasses sont regroupées par destinataire
// (wizard de vente / don, bloc carcasses de la fiche), elles forment un groupe à part sous cet
// identifiant réservé — sinon elles retomberaient dans « à attribuer », faute de destinataire.
export const USAGE_DOMESTIQUE_ID = 'usage-domestique-prive';

export const USAGE_DOMESTIQUE_LABEL = 'Usage domestique privé';
