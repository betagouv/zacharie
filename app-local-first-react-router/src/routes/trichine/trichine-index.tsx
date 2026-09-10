import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import Tooltip from '@codegouvfr/react-dsfr/Tooltip';
import dayjs from 'dayjs';
import { TrichineStatutLogistiqueFTP } from '@prisma/client';
import TrichineRechercheReference from '@app/components/trichine/TrichineRechercheReference';
import useZustandStore from '@app/zustand/store';
import {
  useCarcassesAvecIpm2,
  useTrichineBasePath,
  useTrichinePrelevementEnLot,
} from '@app/utils/trichine-hooks';
import { useSviCarcassesAVenir } from '@app/utils/svi-carcasses-a-venir';
import {
  getTrichineEchantillons,
  getTrichineFTPs,
  getTrichinePools,
  type TrichineEchantillonWithCarcasse,
  type TrichineFTPPopulated,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import {
  isResultatDefavorable,
  poolEnAttenteIpm2,
  poolSansFTP,
  TRICHINE_ESPECE_CONCERNEE,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  resultatCourtLabels,
  statutAnalyseLabels,
  statutLogistiqueLabels,
  statutUtilisateurPool,
} from '@app/utils/trichine';

/**
 * Point d'entrée de l'espace trichine : ce qui demande une action d'abord, les derniers
 * résultats ensuite, et l'accès direct par référence pour retrouver un objet sans passer
 * par les listes.
 */
export default function TrichineIndex() {
  const basePath = useTrichineBasePath();
  const prelevementEnLot = useTrichinePrelevementEnLot();
  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  const carcassesAvecIpm2 = useCarcassesAvecIpm2();
  const { carcasses: carcassesAVenir } = useSviCarcassesAVenir(prelevementEnLot);
  const [echantillons, setEchantillons] = useState<Array<TrichineEchantillonWithCarcasse>>([]);
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [ftps, setFtps] = useState<Array<TrichineFTPPopulated>>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getTrichineEchantillons()
      .then((response) => response.ok && response.data && setEchantillons(response.data.echantillons))
      .catch(console.error);
    getTrichinePools()
      .then((response) => response.ok && response.data && setPools(response.data.pools))
      .catch(console.error);
    getTrichineFTPs()
      .then((response) => response.ok && response.data && setFtps(response.data.ftps))
      .catch(console.error);
  }, []);

  // Les compteurs suivent le parcours réel d'une analyse : prélever → regrouper → envoyer → attendre
  const etapes = useMemo(() => {
    // Même périmètre que l'assistant de prélèvement : les sangliers transmis au SVI et ceux
    // déjà arrivés chez un ETG rattaché, que celui-ci n'a pas encore transmis.
    const prelevables = new Set(
      carcassesRegistry
        .filter(
          (carcasse) =>
            carcasse.espece === TRICHINE_ESPECE_CONCERNEE &&
            !carcasse.deleted_at &&
            !carcasse.trichine_retire_de_fei_at
        )
        .map((carcasse) => carcasse.zacharie_carcasse_id)
    );
    for (const carcasse of carcassesAVenir ?? []) {
      if (carcasse.espece === TRICHINE_ESPECE_CONCERNEE) prelevables.add(carcasse.zacharie_carcasse_id);
    }
    for (const echantillon of echantillons) {
      prelevables.delete(echantillon.zacharie_carcasse_id);
    }
    const aPrelever = prelevementEnLot ? prelevables.size : null;
    const brouillons = ftps.filter(
      (ftp) => ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON
    ).length;

    return [
      aPrelever !== null && {
        cle: 'prelever',
        icone: 'fr-icon-test-tube-line',
        compte: aPrelever,
        titre: 'À prélever',
        detail: `sanglier${aPrelever > 1 ? 's' : ''} sans échantillon`,
        to: `${basePath}/prelever`,
      },
      {
        cle: 'regrouper',
        icone: 'fr-icon-microscope-line',
        compte: echantillons.filter((echantillon) => !echantillon.pool_id).length,
        titre: 'À regrouper',
        detail: 'échantillons sans pool',
        to: `${basePath}/echantillons?pool=sans`,
      },
      {
        cle: 'envoyer',
        icone: 'fr-icon-send-plane-line',
        compte: pools.filter((pool) => poolSansFTP(pool)).length,
        titre: 'À envoyer',
        detail: brouillons > 0 ? `pools · ${brouillons} fiche(s) en brouillon` : 'pools sans transmission',
        to: `${basePath}/pools?vue=a-faire`,
      },
      {
        cle: 'analyse',
        icone: 'fr-icon-time-line',
        compte: pools.filter((pool) => statutUtilisateurPool(pool) === 'En cours').length,
        titre: 'En analyse',
        detail: 'au laboratoire, rien à faire',
        to: `${basePath}/pools?vue=en-cours`,
        attente: true,
      },
    ].filter(Boolean) as Array<{
      cle: string;
      icone: string;
      compte: number;
      titre: string;
      detail: string;
      to: string;
      attente?: boolean;
    }>;
  }, [carcassesRegistry, carcassesAVenir, echantillons, pools, ftps, basePath, prelevementEnLot]);

  // Un résultat défavorable déjà tranché par le SVI (IPM2) n'a plus à être signalé
  const defavorables = useMemo(
    () =>
      pools.filter(
        (pool) => isResultatDefavorable(pool.resultat_analyse) && poolEnAttenteIpm2(pool, carcassesAvecIpm2)
      ),
    [pools, carcassesAvecIpm2]
  );

  const derniersResultats = useMemo(
    () =>
      pools
        .filter((pool) => pool.resultat_analyse)
        .sort(
          (a, b) =>
            dayjs(b.date_fin_analyse ?? b.updated_at).valueOf() -
            dayjs(a.date_fin_analyse ?? a.updated_at).valueOf()
        )
        .slice(0, 5),
    [pools]
  );

  return (
    <div className="fr-container fr-my-4w">
      <title>Suivi trichine | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>

      <header className="fr-mb-3w flex flex-wrap items-center gap-x-3 gap-y-4">
        <h1 className="fr-h3 fr-mb-0">Suivi trichine</h1>
        <Tooltip
          kind="click"
          title="Recherche de trichine sur les sangliers : vous prélevez un échantillon par carcasse, vous les regroupez en pool, vous envoyez le pool à un laboratoire avec une fiche de transmission, et le laboratoire y saisit son résultat."
        />
        <div className="w-full md:ml-auto md:w-96">
          <RechercheReference
            basePath={basePath}
            echantillons={echantillons}
            pools={pools}
            ftps={ftps}
          />
        </div>
      </header>

      {defavorables.length > 0 && (
        <Link
          to={`${basePath}/pools?resultat=DEFAVORABLE_SANS_IPM2`}
          className="fr-mb-3w flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 bg-none p-4 hover:bg-red-100"
        >
          <span
            className="fr-icon-alarm-warning-line fr-icon--lg shrink-0 text-red-700"
            aria-hidden="true"
          />
          <span>
            <span className="block font-semibold text-red-900">
              {defavorables.length} résultat{defavorables.length > 1 ? 's' : ''} défavorable
              {defavorables.length > 1 ? 's' : ''}
            </span>
            <span className="block text-sm text-red-800">
              Les carcasses concernées sont impropres à la consommation et doivent être retirées.
            </span>
          </span>
        </Link>
      )}

      <section
        aria-label="Parcours d'une analyse"
        className="fr-mb-4w"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-0">
          {etapes.map((etape, index) => (
            <div
              key={etape.cle}
              className="flex items-center"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="hidden shrink-0 px-2 text-2xl text-gray-300 lg:block"
                >
                  ›
                </span>
              )}
              <Link
                to={etape.to}
                className={`block h-full flex-1 rounded-lg border bg-none p-4 transition ${
                  etape.compte === 0
                    ? 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                    : etape.attente
                      ? 'border-gray-200 bg-white hover:bg-gray-50'
                      : 'border-[#000091] bg-white hover:bg-blue-50'
                }`}
              >
                <span
                  className={`${etape.icone} fr-icon--lg block ${
                    etape.compte === 0 ? 'text-gray-300' : etape.attente ? 'text-gray-500' : 'text-[#000091]'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`mt-2 block text-3xl font-bold tabular-nums ${
                    etape.compte === 0 ? 'text-gray-300' : 'text-gray-900'
                  }`}
                >
                  {etape.compte}
                </span>
                <span className="block font-semibold text-gray-900">{etape.titre}</span>
                <span className="block text-xs text-gray-600">{etape.detail}</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-label="Derniers résultats"
        className="fr-mb-3w"
      >
        <h2 className="fr-h6 fr-mb-2w">Derniers résultats reçus</h2>
        {derniersResultats.length === 0 ? (
          <p className="fr-text--sm fr-mb-0 rounded border border-gray-200 bg-white p-6 text-gray-500">
            Aucun résultat reçu pour l'instant.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {derniersResultats.map((pool) => (
              <li key={pool.id}>
                <Link
                  to={`${basePath}/pools/${pool.reference_pool}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white bg-none p-4 hover:bg-gray-50"
                >
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-gray-900">{pool.reference_pool}</span>
                    <Badge
                      small
                      severity={resultatBadgeSeverity(pool.resultat_analyse!)}
                    >
                      {resultatAnalyseLabels[pool.resultat_analyse!]}
                    </Badge>
                  </span>
                  <span className="text-sm text-gray-600">
                    {pool.TrichineEchantillons.length} carcasse
                    {pool.TrichineEchantillons.length > 1 ? 's' : ''}
                    {pool.date_fin_analyse
                      ? ` — analysé le ${dayjs(pool.date_fin_analyse).format('DD/MM/YYYY')}`
                      : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Les listes complètes sont dans le menu latéral : ici, un simple rappel des volumes */}
      <p className="fr-text--sm fr-mb-0 text-gray-600">
        <Link
          to={`${basePath}/echantillons`}
          className="fr-link"
        >
          {echantillons.length} échantillons
        </Link>
        {' · '}
        <Link
          to={`${basePath}/pools`}
          className="fr-link"
        >
          {pools.length} pools
        </Link>
        {' · '}
        <Link
          to={`${basePath}/ftp`}
          className="fr-link"
        >
          {ftps.length} transmissions
        </Link>
      </p>
    </div>
  );
}

function RechercheReference({
  basePath,
  echantillons,
  pools,
  ftps,
}: {
  basePath: string;
  echantillons: Array<TrichineEchantillonWithCarcasse>;
  pools: Array<TrichinePoolPopulated>;
  ftps: Array<TrichineFTPPopulated>;
}) {
  const groupes = useMemo(
    () => [
      {
        label: 'Pools',
        options: pools.map((pool) => ({
          value: `${basePath}/pools/${pool.reference_pool}`,
          label: pool.reference_pool,
          detail: pool.resultat_analyse
            ? resultatCourtLabels[pool.resultat_analyse]
            : `${pool.TrichineEchantillons.length} échantillon${pool.TrichineEchantillons.length > 1 ? 's' : ''}`,
        })),
      },
      {
        label: 'Transmissions',
        options: ftps.map((ftp) => ({
          value: `${basePath}/ftp/${ftp.numero_fiche}`,
          label: ftp.numero_fiche,
          detail: `${ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale || ''} — ${statutLogistiqueLabels[ftp.statut_logistique]}`,
        })),
      },
      {
        label: 'Échantillons',
        options: echantillons.map((echantillon) => ({
          value: `${basePath}/echantillons/${echantillon.reference_echantillon}`,
          label: echantillon.reference_echantillon,
          detail: `${echantillon.Carcasse.numero_bracelet ?? ''} — ${statutAnalyseLabels[echantillon.statut]}`,
        })),
      },
    ],
    [basePath, echantillons, pools, ftps]
  );

  return <TrichineRechercheReference groupes={groupes} />;
}
