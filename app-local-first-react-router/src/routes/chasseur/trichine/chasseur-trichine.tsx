import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import {
  envoyerTrichineFTP,
  getTrichineEchantillons,
  getTrichineFTPs,
  getTrichinePools,
  type TrichineEchantillonWithCarcasse,
  type TrichineFTPPopulated,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import {
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
  statutUtilisateurBadgeSeverity,
  statutUtilisateurFTP,
  statutUtilisateurPool,
} from '@app/utils/trichine';
import { TrichineStatutLogistiqueFTP } from '@prisma/client';

type TabId = 'echantillons' | 'pools' | 'ftps';

/**
 * « Mes analyses trichine » (cf doc/trichine.md §6.1) : échantillons, pools, FTP.
 */
export default function ChasseurTrichine() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTabId = (searchParams.get('tab') as TabId) || 'echantillons';

  const [echantillons, setEchantillons] = useState<Array<TrichineEchantillonWithCarcasse>>([]);
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [ftps, setFtps] = useState<Array<TrichineFTPPopulated>>([]);

  const refresh = useCallback(() => {
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refresh();
  }, [refresh]);

  const tabs: TabsProps['tabs'] = [
    { tabId: 'echantillons', label: `Échantillons (${echantillons.length})` },
    { tabId: 'pools', label: `Pools (${pools.length})` },
    { tabId: 'ftps', label: `FTP (${ftps.length})` },
  ];

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Analyses trichine | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Mes analyses trichine</h1>
          <Tabs
            selectedTabId={selectedTabId}
            tabs={tabs}
            onTabChange={(tabId) => setSearchParams({ tab: tabId })}
            className="mb-6 [&_.fr-tabs\\_\\_panel]:bg-white"
          >
            {selectedTabId === 'echantillons' && <TabEchantillons echantillons={echantillons} />}
            {selectedTabId === 'pools' && <TabPools pools={pools} />}
            {selectedTabId === 'ftps' && (
              <TabFTPs
                ftps={ftps}
                onChanged={refresh}
              />
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function TabEchantillons({ echantillons }: { echantillons: Array<TrichineEchantillonWithCarcasse> }) {
  const navigate = useNavigate();
  return (
    <>
      <p className="fr-text--sm">
        Les échantillons se créent depuis la page de chaque carcasse de sanglier. Regroupez ensuite vos
        échantillons en pool (19 carcasses maximum) pour les envoyer au laboratoire.
      </p>
      {echantillons.length === 0 ? (
        <p className="fr-text--sm">Aucun échantillon prélevé.</p>
      ) : (
        <ul className="list-none space-y-3 p-0">
          {echantillons.map((echantillon) => (
            <li
              key={echantillon.id}
              className="rounded border border-gray-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{echantillon.reference_echantillon}</span>
                <Badge
                  small
                  severity={statutAnalyseBadgeSeverity(echantillon.statut)}
                >
                  {statutAnalyseLabels[echantillon.statut]}
                </Badge>
                {echantillon.resultat_analyse && (
                  <Badge
                    small
                    severity={resultatBadgeSeverity(echantillon.resultat_analyse)}
                  >
                    {resultatAnalyseLabels[echantillon.resultat_analyse]}
                  </Badge>
                )}
                {!echantillon.pool_id && (
                  <Badge
                    small
                    severity="new"
                  >
                    À regrouper en pool
                  </Badge>
                )}
              </div>
              <p className="fr-text--sm fr-mb-0 mt-1">
                Carcasse {echantillon.Carcasse.numero_bracelet} — {echantillon.masse_grammes} g — prélevé le{' '}
                {dayjs(echantillon.date_prelevement).format('DD/MM/YYYY')}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="fr-mt-2w">
        <Button
          type="button"
          disabled={!echantillons.some((echantillon) => !echantillon.pool_id)}
          onClick={() => navigate('/app/chasseur/trichine/nouveau-pool')}
        >
          Créer un nouveau pool
        </Button>
      </div>
    </>
  );
}

function TabPools({ pools }: { pools: Array<TrichinePoolPopulated> }) {
  return (
    <>
      {pools.length === 0 ? (
        <p className="fr-text--sm">Aucun pool constitué.</p>
      ) : (
        <ul className="list-none space-y-3 p-0">
          {pools.map((pool) => {
            const statutUtilisateur = statutUtilisateurPool(pool);
            return (
              <li
                key={pool.id}
                className="rounded border border-gray-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{pool.reference_pool}</span>
                  <Badge
                    small
                    severity={statutUtilisateurBadgeSeverity(statutUtilisateur)}
                  >
                    {statutUtilisateur}
                  </Badge>
                  <Badge
                    small
                    severity={statutAnalyseBadgeSeverity(pool.statut)}
                  >
                    {statutAnalyseLabels[pool.statut]}
                  </Badge>
                  {pool.resultat_analyse && (
                    <Badge
                      small
                      severity={resultatBadgeSeverity(pool.resultat_analyse)}
                    >
                      {resultatAnalyseLabels[pool.resultat_analyse]}
                    </Badge>
                  )}
                </div>
                <p className="fr-text--sm fr-mb-0 mt-1">
                  {pool.TrichineEchantillons.length} échantillon(s) — constitué le{' '}
                  {dayjs(pool.date_constitution).format('DD/MM/YYYY')}
                  {pool.raison_refus ? ` — Refus : ${pool.raison_refus}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="fr-mt-2w flex flex-wrap gap-2">
        <Button linkProps={{ to: '/app/chasseur/trichine/nouveau-pool' }}>Créer un nouveau pool</Button>
        <Button
          priority="secondary"
          linkProps={{ to: '/app/chasseur/trichine/nouvelle-ftp' }}
        >
          Créer une FTP
        </Button>
      </div>
    </>
  );
}

function TabFTPs({ ftps, onChanged }: { ftps: Array<TrichineFTPPopulated>; onChanged: () => void }) {
  const navigate = useNavigate();
  const [sendingId, setSendingId] = useState<string | null>(null);

  return (
    <>
      {ftps.length === 0 ? (
        <p className="fr-text--sm">Aucune fiche de transmission des prélèvements (FTP).</p>
      ) : (
        <ul className="list-none space-y-3 p-0">
          {ftps.map((ftp) => {
            const statutUtilisateur = statutUtilisateurFTP(ftp);
            return (
              <li
                key={ftp.id}
                className="rounded border border-gray-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{ftp.numero_fiche}</span>
                  <Badge
                    small
                    severity={statutUtilisateurBadgeSeverity(statutUtilisateur)}
                  >
                    {statutUtilisateur}
                  </Badge>
                  <Badge
                    small
                    severity="info"
                  >
                    {statutLogistiqueLabels[ftp.statut_logistique]}
                  </Badge>
                  <Badge
                    small
                    severity={statutAnalyseBadgeSeverity(ftp.statut_analytique)}
                  >
                    {statutAnalyseLabels[ftp.statut_analytique]}
                  </Badge>
                </div>
                <p className="fr-text--sm fr-mb-0 mt-1">
                  {ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale} —{' '}
                  {ftp.TrichinePoolFTPs.length} pool(s)
                  {ftp.date_envoi ? ` — envoyée le ${dayjs(ftp.date_envoi).format('DD/MM/YYYY')}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    priority="tertiary"
                    size="small"
                    onClick={() => navigate(`/app/chasseur/trichine/ftp/${ftp.id}`)}
                  >
                    Voir le détail
                  </Button>
                  {ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON && (
                    <Button
                      type="button"
                      size="small"
                      disabled={sendingId === ftp.id}
                      onClick={() => {
                        setSendingId(ftp.id);
                        envoyerTrichineFTP(ftp.id)
                          .then((response) => {
                            if (response.ok) {
                              toast.success(`FTP ${ftp.numero_fiche} envoyée au laboratoire`);
                              onChanged();
                            } else {
                              toast.error(response.error || 'Une erreur est survenue');
                            }
                          })
                          .catch(() => toast.error('Une erreur est survenue'))
                          .finally(() => setSendingId(null));
                      }}
                    >
                      Envoyer au laboratoire
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="fr-mt-2w">
        <Button linkProps={{ to: '/app/chasseur/trichine/nouvelle-ftp' }}>Créer une FTP</Button>
      </div>
    </>
  );
}
