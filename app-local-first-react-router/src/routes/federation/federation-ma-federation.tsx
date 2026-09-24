import { useEffect } from 'react';
import MaFederation from '@app/components/MaFederation';

export default function FederationMaFederation() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Ma fédération | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Ma fédération</h1>
          <MaFederation />
        </div>
      </div>
    </div>
  );
}
