import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import Tooltip from '@codegouvfr/react-dsfr/Tooltip';
import dayjs from 'dayjs';
import TrichineRechercheReference from '@app/components/trichine/TrichineRechercheReference';
import {
  getLaboFTPs,
  getLaboMe,
  getLaboPools,
  type LaboFTPListItem,
  type LaboPoolRegistre,
} from '@app/services/laboratoire';
import {
  filtreLaboFTP,
  ftpTrichineNiveau,
  resultatCourtLabels,
  statutAnalyseLabels,
  statutLogistiqueLabels,
  statutLogistiqueLaboLabels,
} from '@app/utils/trichine';

function expediteurDisplay(ftp: LaboFTPListItem): string {
  const user = `${ftp.ExpediteurUser.prenom ?? ''} ${ftp.ExpediteurUser.nom_de_famille ?? ''}`.trim();
  const entity = ftp.ExpediteurEntity
    ? (ftp.ExpediteurEntity.nom_d_usage ?? ftp.ExpediteurEntity.raison_sociale ?? '')
    : '';
  return entity ? `${user} (${entity})` : user;
}

/**
 * Point d'entrée de l'espace laboratoire. Comme côté émetteur, l'écran suit le parcours réel
 * d'un colis — réceptionner puis analyser — plutôt que d'aligner des compteurs à déchiffrer.
 */
export default function LaboratoireIndex() {
  const [ftps, setFtps] = useState<Array<LaboFTPListItem>>([]);
  const [pools, setPools] = useState<Array<LaboPoolRegistre>>([]);
  const [isLnr, setIsLnr] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getLaboFTPs()
      .then((response) => response.ok && response.data && setFtps(response.data.ftps))
      .catch(console.error);
    getLaboPools()
      .then((response) => response.ok && response.data && setPools(response.data.pools))
      .catch(console.error);
    getLaboMe()
      .then((response) => response.ok && response.data && setIsLnr(response.data.isLnr))
      .catch(console.error);
  }, []);

  const etapes = useMemo(() => {
    const parFiltre = { 'a-traiter': 0, 'en-cours': 0, cloturees: 0 };
    // Une fiche que le labo a émise vers le LNR n'est pas une réception à venir
    for (const ftp of ftps) if (ftp.direction === 'recue') parFiltre[filtreLaboFTP(ftp)]++;
    return [
      {
        cle: 'receptionner',
        icone: 'fr-icon-inbox-line',
        compte: parFiltre['a-traiter'],
        titre: 'À réceptionner',
        detail: 'colis annoncés, pas encore reçus',
        to: '/app/laboratoire/ftp?vue=a-traiter',
      },
      {
        cle: 'analyser',
        icone: 'fr-icon-microscope-line',
        compte: pools.filter((pool) => !pool.resultat_analyse && pool.date_reception).length,
        titre: 'À analyser',
        detail: 'pools reçus sans résultat saisi',
        to: '/app/laboratoire/pools?vue=a-analyser',
      },
      {
        cle: 'cloturees',
        icone: 'fr-icon-archive-line',
        compte: parFiltre.cloturees,
        titre: 'Clôturées',
        detail: 'fiches traitées, rien à faire',
        to: '/app/laboratoire/ftp?vue=cloturees',
        attente: true,
      },
    ];
  }, [ftps, pools]);

  // Le LNR ne reçoit que des confirmations de résultats douteux : l'alerte n'y a pas de sens.
  // Ailleurs, une fiche dont toutes les carcasses ont une IPM2 a été traitée par le SVI.
  const trichine = useMemo(
    () => (isLnr ? [] : ftps.filter((ftp) => ftpTrichineNiveau(ftp) !== null && ftp.carcasses_sans_ipm2 > 0)),
    [ftps, isLnr]
  );

  const groupes = useMemo(
    () => [
      {
        label: 'Transmissions',
        options: ftps.map((ftp) => ({
          value: `/app/laboratoire/ftp/${ftp.numero_fiche}`,
          label: ftp.numero_fiche,
          detail:
            ftp.direction === 'envoyee'
              ? `Envoyée au LNR — ${statutLogistiqueLabels[ftp.statut_logistique]}`
              : `${expediteurDisplay(ftp)} — ${statutLogistiqueLaboLabels[ftp.statut_logistique]}`,
        })),
      },
      {
        label: 'Pools',
        options: pools.map((pool) => ({
          value: `/app/laboratoire/pools/${pool.reference_pool}`,
          label: pool.reference_pool,
          detail: pool.resultat_analyse
            ? resultatCourtLabels[pool.resultat_analyse]
            : statutAnalyseLabels[pool.statut],
        })),
      },
    ],
    [ftps, pools]
  );

  const aReceptionner = ftps
    .filter((ftp) => ftp.direction === 'recue' && filtreLaboFTP(ftp) === 'a-traiter')
    .slice(0, 5);

  return (
    <div className="py-4">
      <title>À traiter | Laboratoire | Zacharie</title>

      <header className="fr-mb-3w flex flex-wrap items-center gap-x-3 gap-y-4">
        <h1 className="fr-h3 fr-mb-0">À traiter</h1>
        <Tooltip
          kind="click"
          title="Les détenteurs vous envoient des colis d'échantillons de sanglier accompagnés d'une fiche de transmission (FTP). Vous confirmez sa réception, puis vous saisissez un résultat par pool."
        />
        <div className="w-full md:ml-auto md:w-96">
          <TrichineRechercheReference
            groupes={groupes}
            hint="Tapez un n° de fiche, un pool ou un expéditeur"
          />
        </div>
      </header>

      {trichine.length > 0 && (
        <Link
          to="/app/laboratoire/ftp?vue=trichine-en-attente"
          className="fr-mb-3w flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 bg-none p-4 hover:bg-red-100"
        >
          <span
            className="fr-icon-alarm-warning-line fr-icon--lg shrink-0 text-red-700"
            aria-hidden="true"
          />
          <span>
            <span className="block font-semibold text-red-900">
              {trichine.length} fiche{trichine.length > 1 ? 's' : ''} avec trichine confirmée ou suspectée
            </span>
            <span className="block text-sm text-red-800">
              À traiter en priorité : un résultat douteux part en confirmation au laboratoire national de
              référence.
            </span>
          </span>
        </Link>
      )}

      <section
        aria-label="Parcours d'un colis"
        className="fr-mb-4w"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-0">
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
        aria-label="Prochaines réceptions"
        className="fr-mb-3w"
      >
        <h2 className="fr-h6 fr-mb-2w">Prochaines réceptions</h2>
        {aReceptionner.length === 0 ? (
          <p className="fr-text--sm fr-mb-0 rounded border border-gray-200 bg-white p-6 text-gray-500">
            Aucune fiche en attente de réception.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {aReceptionner.map((ftp) => (
              <li key={ftp.id}>
                <Link
                  to={`/app/laboratoire/ftp/${ftp.numero_fiche}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white bg-none p-4 hover:bg-gray-50"
                >
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-gray-900">{ftp.numero_fiche}</span>
                    <Badge
                      small
                      severity="info"
                    >
                      {statutLogistiqueLaboLabels[ftp.statut_logistique]}
                    </Badge>
                  </span>
                  <span className="text-sm text-gray-600">
                    {expediteurDisplay(ftp)} — {ftp.TrichinePoolFTPs.length} pool
                    {ftp.TrichinePoolFTPs.length > 1 ? 's' : ''}
                    {ftp.date_envoi ? ` — envoyée le ${dayjs(ftp.date_envoi).format('DD/MM/YYYY')}` : ''}
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
          to="/app/laboratoire/ftp?vue=tous"
          className="fr-link"
        >
          {ftps.length} transmissions
        </Link>
        {' · '}
        <Link
          to="/app/laboratoire/pools"
          className="fr-link"
        >
          {pools.length} pools reçus
        </Link>
        {' · '}
        <Link
          to="/app/laboratoire/echantillons"
          className="fr-link"
        >
          registre des échantillons
        </Link>
      </p>
    </div>
  );
}
