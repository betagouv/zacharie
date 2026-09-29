import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { BugInvestigationStatus } from '@prisma/client';

export default function BugInvestigationStatusBadge({ status }: { status: BugInvestigationStatus }) {
  switch (status) {
    case BugInvestigationStatus.EN_COURS:
      return <Badge severity="info">En cours</Badge>;
    case BugInvestigationStatus.TERMINE:
      return <Badge severity="success">Terminée</Badge>;
    case BugInvestigationStatus.ERREUR:
      return <Badge severity="error">Erreur</Badge>;
  }
}
