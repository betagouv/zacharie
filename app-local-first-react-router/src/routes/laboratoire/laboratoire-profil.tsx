import { useEffect, useState } from 'react';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { getLaboMe, type LaboEntity } from '@app/services/laboratoire';

/**
 * « Mon laboratoire » — lecture seule : les coordonnées et l'accréditation COFRAC
 * sont gérées par l'administration Zacharie (cf doc/trichine.md §3.2, annuaire LVD).
 */
export default function LaboratoireProfil() {
  const [laboratoires, setLaboratoires] = useState<Array<LaboEntity>>([]);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getLaboMe()
      .then((response) => {
        if (response.ok && response.data) setLaboratoires(response.data.laboratoires);
      })
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, []);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Mon laboratoire | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Mon laboratoire</h1>
          {!hasTriedLoading ? (
            <p className="fr-text--sm">Chargement…</p>
          ) : (
            laboratoires.map((laboratoire) => (
              <div
                key={laboratoire.id}
                className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm"
              >
                <div className="fr-mb-2w flex flex-wrap items-center gap-2">
                  <h2 className="fr-h5 fr-mb-0">{laboratoire.nom_d_usage || laboratoire.raison_sociale}</h2>
                  {laboratoire.is_lnr && (
                    <Badge
                      small
                      severity="new"
                    >
                      Laboratoire National de Référence
                    </Badge>
                  )}
                </div>
                <ul className="fr-text--sm space-y-1">
                  {laboratoire.raison_sociale && <li>Raison sociale : {laboratoire.raison_sociale}</li>}
                  {laboratoire.siret && <li>SIRET : {laboratoire.siret}</li>}
                  <li>
                    Adresse :{' '}
                    {[laboratoire.address_ligne_1, laboratoire.address_ligne_2].filter(Boolean).join(', ') ||
                      '—'}
                    {laboratoire.code_postal ? `, ${laboratoire.code_postal}` : ''} {laboratoire.ville ?? ''}
                  </li>
                </ul>
              </div>
            ))
          )}
          <Alert
            severity="info"
            small
            description="Les coordonnées et l'accréditation COFRAC de votre laboratoire sont gérées par l'équipe Zacharie. Contactez-nous pour toute mise à jour."
          />
        </div>
      </div>
    </div>
  );
}
