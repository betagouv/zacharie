import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';

// Affiché quand l'utilisateur n'a plus aucune action à effectuer sur la fiche
// (ex: fiche renvoyée à l'expéditeur, fiche gérée par d'autres détenteurs).
export default function FeiAucuneAction({ backTo }: { backTo: string }) {
  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 m-4 md:m-0">
          <Alert
            severity="info"
            title="Aucune action à effectuer"
            description="Vous n'avez plus d'action à effectuer sur cette fiche."
          />
          <div className="mt-8 flex justify-start">
            <Button
              priority="secondary"
              linkProps={{ to: backTo }}
            >
              Voir toutes mes fiches
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
