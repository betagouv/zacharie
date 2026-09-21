import etablissementsTraitementSanitaire from '@app/data/etablissements-traitement-sanitaire.json';

// Le fichier est importé dans le bundle : c'est une projection allégée du référentiel complet
// (api-express/src/assets/etablissements-traitement-sanitaire.json). Seuls les 5 champs affichés
// par le sélecteur sont conservés, sous des clés abrégées : n = numéro d'agrément,
// r = raison sociale, a = adresse, c = code postal, v = commune.
type EtablissementDisplay = string;
type Etablissement = (typeof etablissementsTraitementSanitaire.data)[number];

function getEtablissementDisplay(etablissement: Etablissement): EtablissementDisplay {
  return `${etablissement.n} - ${etablissement.r} - ${etablissement.a} - ${etablissement.c} ${etablissement.v}`;
}

export const etablissementsTree = etablissementsTraitementSanitaire.data.map(getEtablissementDisplay);

export function retrieveEtablissementAgremenet(
  etablissementDisplay: EtablissementDisplay
): Etablissement['n'] {
  const etablissement = etablissementsTraitementSanitaire.data.find(
    (etablissement) => getEtablissementDisplay(etablissement) === etablissementDisplay
  );
  return etablissement!.n;
}
