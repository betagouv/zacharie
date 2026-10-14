import dayjs from 'dayjs';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { TrichineResultatAnalyse, type TrichinePool } from '@prisma/client';
import {
  isResultatDefavorable,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  statutAnalyseLabels,
} from '@app/utils/trichine';
import { TrichineCard, TrichineFields } from '@app/components/trichine/TrichineDetailPage';

/**
 * Le résultat d'analyse n'a pas de page à lui : il appartient au pool, et c'est ici qu'il
 * s'affiche avec sa provenance (laboratoire, dates, référence labo). Échantillons et carcasses
 * n'en portent qu'un écho.
 *
 * La référence interne est celle du laboratoire affiché : elle est portée par le lien
 * pool ↔ FTP, chaque laboratoire ayant la sienne.
 */
export default function TrichineResultatCard({
  pool,
  laboratoire,
  referenceLabo,
}: {
  pool: Pick<
    TrichinePool,
    | 'statut'
    | 'resultat_analyse'
    | 'parasite_identifie'
    | 'date_reception'
    | 'date_debut_analyse'
    | 'date_fin_analyse'
    | 'raison_refus'
    | 'commentaire'
  >;
  laboratoire?: string | null;
  referenceLabo?: string | null;
}) {
  const resultat = pool.resultat_analyse;

  return (
    <TrichineCard titre="Résultat d'analyse">
      {resultat ? (
        <>
          <div className="fr-mb-2w flex flex-wrap items-center gap-3">
            <Badge severity={resultatBadgeSeverity(resultat)}>{resultatAnalyseLabels[resultat]}</Badge>
            {isResultatDefavorable(resultat) && (
              <span className="fr-text--sm m-0 font-medium">
                Les carcasses de ce pool sont impropres à la consommation.
              </span>
            )}
            {resultat === TrichineResultatAnalyse.DOUTEUX && (
              <span className="fr-text--sm m-0 font-medium">
                Confirmation par le laboratoire national de référence en cours.
              </span>
            )}
          </div>
          <TrichineFields
            fields={[
              !!pool.parasite_identifie && {
                label: 'Parasite identifié',
                value: pool.parasite_identifie,
              },
              !!laboratoire && { label: 'Laboratoire', value: laboratoire },
              !!referenceLabo && { label: 'Référence laboratoire', value: referenceLabo },
              !!pool.date_debut_analyse && {
                label: 'Début d’analyse',
                value: dayjs(pool.date_debut_analyse).format('DD/MM/YYYY'),
              },
              !!pool.date_fin_analyse && {
                label: 'Fin d’analyse',
                value: dayjs(pool.date_fin_analyse).format('DD/MM/YYYY'),
              },
              !!pool.raison_refus && { label: 'Raison du refus', value: pool.raison_refus },
            ]}
          />
        </>
      ) : (
        <>
          <p className="fr-text--sm fr-mb-2w text-gray-600">
            Aucun résultat saisi par le laboratoire pour l'instant.
          </p>
          <TrichineFields
            fields={[
              { label: 'Statut', value: statutAnalyseLabels[pool.statut] },
              !!laboratoire && { label: 'Laboratoire', value: laboratoire },
              !!pool.date_reception && {
                label: 'Reçu au laboratoire le',
                value: dayjs(pool.date_reception).format('DD/MM/YYYY'),
              },
            ]}
          />
        </>
      )}
      {!!pool.commentaire && <p className="fr-text--sm fr-mt-2w fr-mb-0">{pool.commentaire}</p>}
    </TrichineCard>
  );
}
