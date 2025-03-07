import etablissementsTraitementSanitaire from '@app/data/etablissements-traitement-sanitaire.json';

type EtablissementDisplay = string;
type Etablissement = (typeof etablissementsTraitementSanitaire.data)[number];

function getEtablissementDisplay(etablissement: Etablissement): EtablissementDisplay {
  return `${etablissement['Numéro agrément/Approval number']} - ${etablissement['Raison SOCIALE - Enseigne commerciale/Name']} - ${etablissement['Adresse/Adress']} - ${etablissement['Code postal/Postal code']} ${etablissement['Commune/Town']}`;
}

export const etablissementsTree = etablissementsTraitementSanitaire.data.map(getEtablissementDisplay);

export function retrieveEtablissementAgremenet(
  etablissementDisplay: EtablissementDisplay,
): Etablissement['Numéro agrément/Approval number'] {
  const etablissement = etablissementsTraitementSanitaire.data.find(
    (etablissement) => getEtablissementDisplay(etablissement) === etablissementDisplay,
  );
  return etablissement!['Numéro agrément/Approval number'];
}
