import { Badge } from '@codegouvfr/react-dsfr/Badge';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse, TrichineStatutAnalyse } from '@prisma/client';
import {
  resultatBadgeSeverity,
  resultatCourtLabels,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
} from '@app/utils/trichine';

/** Cellules communes aux listes du laboratoire (pools, échantillons). */

export function dateFmt(value: string | Date | null): string {
  return value ? dayjs(value).format('DD/MM/YYYY') : '—';
}

export function ResultatBadge({ resultat }: { resultat: TrichineResultatAnalyse | null }) {
  if (!resultat) return <>—</>;
  return (
    <Badge
      small
      severity={resultatBadgeSeverity(resultat)}
    >
      {resultatCourtLabels[resultat]}
    </Badge>
  );
}

export function StatutBadge({ statut }: { statut: TrichineStatutAnalyse }) {
  return (
    <Badge
      small
      severity={statutAnalyseBadgeSeverity(statut)}
    >
      {statutAnalyseLabels[statut]}
    </Badge>
  );
}

export const statutAnalyseOptions = Object.values(TrichineStatutAnalyse).map((statut) => ({
  value: statut,
  label: statutAnalyseLabels[statut],
}));
