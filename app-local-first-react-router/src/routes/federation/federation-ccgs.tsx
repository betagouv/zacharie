import MesCCGs from '@app/routes/chasseur/profil/chasseur-ccgs';

export default function FederationCCGs() {
  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Chambres froides | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <MesCCGs editBasePath="/app/federation/profil/ccgs" />
        </div>
      </div>
    </div>
  );
}
