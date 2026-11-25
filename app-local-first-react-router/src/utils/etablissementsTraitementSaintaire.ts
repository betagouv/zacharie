import etablissementsTraitementSanitaire from '@app/data/etablissements-traitement-sanitaire.json';

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
