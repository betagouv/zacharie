import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import dayjs from 'dayjs';
import { TrichineStatutLogistiqueFTP, type TrichineHistoriqueStatut } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import PoolCard, {
  refusModal,
  RefusModalContent,
  resultatModal,
  ResultatModalContent,
  type ResultatMode,
} from '@app/components/laboratoire/PoolCard';
import TrichineIntrouvable from '@app/components/trichine/TrichineIntrouvable';
import TrichineChaine, { type ChaineEtape } from '@app/components/trichine/TrichineChaine';
import TrichineChronologie from '@app/components/trichine/TrichineChronologie';
import TrichineDetailPage, {
  TrichineCard,
  TrichineContact,
  TrichineFields,
  TrichineSeparateur,
} from '@app/components/trichine/TrichineDetailPage';
import {
  getLaboMe,
  getLaboPool,
  type LaboPool,
  type LaboPoolDetail,
  type LaboExpediteur,
} from '@app/services/laboratoire';
import {
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
  statutLogistiqueLaboLabels,
  trichineTypeLabels,
} from '@app/utils/trichine';

type FtpDuPool = { numero_fiche: string; statut_logistique: TrichineStatutLogistiqueFTP } & LaboExpediteur;

/**
 * Détail d'un pool reçu au laboratoire : composition, provenance, et saisie du résultat —
 * la même carte que sur la fiche de transmission, pour que le geste soit identique des deux côtés.
 */
export default function LaboratoirePoolDetail() {
  const { reference } = useParams();
  const [pool, setPool] = useState<LaboPoolDetail | null>(null);
  const [ftp, setFtp] = useState<FtpDuPool | null>(null);
  const [historique, setHistorique] = useState<Array<TrichineHistoriqueStatut>>([]);
  const [isLnr, setIsLnr] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refusPool, setRefusPool] = useState<LaboPool | null>(null);
  const [resultatPool, setResultatPool] = useState<LaboPool | null>(null);
  const [resultatMode, setResultatMode] = useState<ResultatMode>('saisie');

  const refresh = useCallback(() => {
    if (!reference) return;
    getLaboPool(reference)
      .then((response) => {
        if (response.ok && response.data) {
          setPool(response.data.pool);
          setFtp(response.data.ftp as FtpDuPool);
          setHistorique(response.data.historique);
        } else {
          setPool(null);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [reference]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refresh();
    getLaboMe()
      .then((response) => {
        if (response.ok && response.data) setIsLnr(response.data.isLnr);
      })
      .catch(console.error);
  }, [refresh]);

  if (isLoading) return <Chargement />;
  if (!pool || !ftp) {
    return (
      <TrichineIntrouvable
        objet="Pool"
        reference={reference}
        retour={{ to: '/app/laboratoire/pools', label: 'Voir tous les pools' }}
        basePath="/app/laboratoire"
      />
    );
  }

  const expediteur = `${ftp.ExpediteurUser.prenom ?? ''} ${ftp.ExpediteurUser.nom_de_famille ?? ''}`.trim();
  const expediteurEntity = ftp.ExpediteurEntity
    ? ftp.ExpediteurEntity.nom_d_usage || ftp.ExpediteurEntity.raison_sociale
    : null;
  const receptionne = !!pool.date_reception;

  const etapes: Array<ChaineEtape> = [
    { label: 'Émetteur', value: expediteurEntity || expediteur || '—' },
    {
      label: 'FTP',
      value: ftp.numero_fiche,
      to: `/app/laboratoire/ftp/${ftp.numero_fiche}`,
    },
    { label: 'Pool', value: pool.reference_pool, current: true },
    { label: 'Échantillons', value: `${pool.TrichineEchantillons.length}` },
  ];

  return (
    <TrichineDetailPage
      surtitre="Pool reçu au laboratoire"
      titre={pool.reference_pool}
      retour={{ to: '/app/laboratoire/pools', label: 'Tous les pools' }}
      badges={
        <>
          <Badge severity={statutAnalyseBadgeSeverity(pool.statut)}>{statutAnalyseLabels[pool.statut]}</Badge>
          <Badge severity="info">{trichineTypeLabels[pool.type]}</Badge>
          {!receptionne && <Badge severity="new">Fiche non réceptionnée</Badge>}
        </>
      }
      chaine={<TrichineChaine etapes={etapes} />}
      aside={
        <>
          <TrichineCard titre="Provenance">
            <TrichineContact
              nom={expediteur}
              organisation={expediteurEntity}
              email={ftp.ExpediteurUser.email}
              telephone={ftp.ExpediteurUser.telephone}
            />
            <TrichineSeparateur />
            <TrichineFields
              disposition="lignes"
              fields={[
                {
                  label: 'Fiche de transmission',
                  value: (
                    <Link
                      to={`/app/laboratoire/ftp/${ftp.numero_fiche}`}
                      className="fr-link"
                    >
                      {ftp.numero_fiche}
                    </Link>
                  ),
                },
                {
                  label: 'Statut de la fiche',
                  value: statutLogistiqueLaboLabels[ftp.statut_logistique],
                },
                !!pool.PoolParent && { label: 'Pool parent', value: pool.PoolParent.reference_pool },
              ]}
            />
          </TrichineCard>
          <TrichineCard titre="Dates">
            <TrichineFields
              disposition="lignes"
              fields={[
                {
                  label: 'Constitué le',
                  value: dayjs(pool.date_constitution).format('DD/MM/YYYY'),
                },
                {
                  label: 'Reçu le',
                  value: pool.date_reception ? dayjs(pool.date_reception).format('DD/MM/YYYY') : 'Pas encore',
                },
                !!pool.date_debut_analyse && {
                  label: 'Début d’analyse',
                  value: dayjs(pool.date_debut_analyse).format('DD/MM/YYYY'),
                },
                !!pool.date_fin_analyse && {
                  label: 'Fin d’analyse',
                  value: dayjs(pool.date_fin_analyse).format('DD/MM/YYYY'),
                },
              ]}
            />
          </TrichineCard>
          <TrichineChronologie historique={historique} />
        </>
      }
    >
      <PoolCard
        pool={pool}
        isLnr={isLnr}
        saisieActive={receptionne}
        onRefuser={() => {
          setRefusPool(pool);
          refusModal.open();
        }}
        onSaisirResultat={() => {
          setResultatPool(pool);
          setResultatMode('saisie');
          resultatModal.open();
        }}
        onCorrigerResultat={() => {
          setResultatPool(pool);
          setResultatMode('correction');
          resultatModal.open();
        }}
        onDocumentDepose={refresh}
      />

      {pool.TrichinePoolFTPs.length > 1 && (
        <TrichineCard
          titre="Fiches de transmission"
          hint="Un pool douteux repart au laboratoire national de référence par une fiche de confirmation."
        >
          <ul className="m-0 list-none space-y-2 p-0">
            {pool.TrichinePoolFTPs.map(({ TrichineFTP: fiche }) => (
              <li
                key={fiche.numero_fiche}
                className="flex flex-wrap items-baseline gap-2"
              >
                <Link
                  to={`/app/laboratoire/ftp/${fiche.numero_fiche}`}
                  className="fr-link"
                >
                  {fiche.numero_fiche}
                </Link>
                <span className="text-sm text-gray-600">
                  {fiche.DestinataireEntity.is_lnr ? 'vers le LNR' : 'reçue'} —{' '}
                  {
                    (fiche.DestinataireEntity.is_lnr ? statutLogistiqueLabels : statutLogistiqueLaboLabels)[
                      fiche.statut_logistique
                    ]
                  }
                </span>
              </li>
            ))}
          </ul>
        </TrichineCard>
      )}

      <ResultatModalContent
        pool={resultatPool}
        isLnr={isLnr}
        mode={resultatMode}
        onDone={refresh}
      />

      <RefusModalContent
        pool={refusPool}
        onDone={refresh}
      />
    </TrichineDetailPage>
  );
}
