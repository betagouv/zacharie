import { useEffect, useMemo, useState } from 'react';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import dayjs from 'dayjs';
import type {
  AdminTrichineDocumentRow,
  AdminTrichineDocumentsResponse,
  AdminTrichineEchantillonRow,
  AdminTrichineEchantillonsResponse,
  AdminTrichineFtpRow,
  AdminTrichineFtpsResponse,
  AdminTrichinePoolRow,
  AdminTrichinePoolsResponse,
} from '@api/src/types/responses';
import TableFilterable from '@app/components/TableFilterable';
import { TrichineListToolbar, FiltreSelect } from '@app/components/trichine/TrichineListPage';
import { filterTrichineRows } from '@app/utils/trichine';
import API from '@app/services/api';

/**
 * Vue d'ensemble trichine pour l'admin : ce qui est stocké, et l'état des analyses.
 * Les listes sont bornées aux plus récentes côté serveur, les filtres sont locaux.
 */

const RESULTAT_SEVERITY: Record<string, 'success' | 'error' | 'warning' | undefined> = {
  NEGATIF: 'success',
  DOUTEUX: 'warning',
  NON_NEGATIF: 'warning',
  PRESENCE_PARASITE_NON_IDENTIFIE: 'warning',
  POSITIF: 'error',
  ANALYSE_IMPOSSIBLE: undefined,
};

/** Options d'un filtre, construites sur les valeurs réellement présentes dans la liste. */
function optionsDe<T>(rows: T[], getValue: (row: T) => string | null | undefined, tous = 'Tous') {
  const valeurs = [...new Set(rows.map(getValue).filter((valeur): valeur is string => !!valeur))].sort();
  return [{ value: '', label: tous }, ...valeurs.map((valeur) => ({ value: valeur, label: valeur }))];
}

function Resultat({ resultat }: { resultat: string | null }) {
  if (!resultat) return <>—</>;
  return (
    <Badge
      small
      severity={RESULTAT_SEVERITY[resultat]}
    >
      {resultat}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

function OngletDocuments() {
  const [documents, setDocuments] = useState<AdminTrichineDocumentRow[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    API.get({ path: 'admin/trichine/documents' }).then((res) => {
      const reponse = res as AdminTrichineDocumentsResponse;
      if (reponse.ok) setDocuments(reponse.data.documents);
    });
  }, []);

  const rows = useMemo(() => {
    const filtres = type ? documents.filter((document) => document.type === type) : documents;
    return filterTrichineRows(filtres, query, (document) =>
      [document.nom_fichier, document.pool_reference, document.ftp_numero, document.depose_par]
        .filter(Boolean)
        .join(' ')
    );
  }, [documents, query, type]);

  return (
    <>
      <TrichineListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="Nom de fichier, pool, FTP, déposé par"
      >
        <FiltreSelect
          label="Type"
          value={type}
          onChange={setType}
          options={optionsDe(documents, (document) => document.type)}
        />
      </TrichineListToolbar>

      <p className="fr-text--sm text-gray-600">{rows.length} document(s)</p>

      <TableFilterable
        data={rows}
        rowKey="id"
        noData="Aucun document"
        columns={[
          {
            title: 'Ajouté le',
            dataKey: 'date_ajout',
            render: (document) => dayjs(document.date_ajout).format('DD/MM/YYYY HH:mm'),
          },
          {
            title: 'Fichier',
            dataKey: 'nom_fichier',
            render: (document) => (
              <span className="break-words">
                {document.nom_fichier || '—'}
                <span className="fr-text--xs block text-gray-500">{document.type}</span>
              </span>
            ),
          },
          {
            title: 'Déposé par',
            dataKey: 'depose_par',
            render: (document) => <span className="break-all">{document.depose_par}</span>,
          },
          {
            title: 'Rattaché à',
            dataKey: 'pool_reference',
            render: (document) => document.pool_reference || document.ftp_numero || '—',
          },
        ]}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Pools                                                                       */
/* -------------------------------------------------------------------------- */

function OngletPools() {
  const [pools, setPools] = useState<AdminTrichinePoolRow[]>([]);
  const [query, setQuery] = useState('');
  const [resultat, setResultat] = useState('');
  const [laboratoire, setLaboratoire] = useState('');

  useEffect(() => {
    API.get({ path: 'admin/trichine/pools' }).then((res) => {
      const reponse = res as AdminTrichinePoolsResponse;
      if (reponse.ok) setPools(reponse.data.pools);
    });
  }, []);

  const rows = useMemo(() => {
    let filtres = pools;
    if (resultat === 'AUCUN') filtres = filtres.filter((pool) => !pool.resultat_analyse);
    else if (resultat) filtres = filtres.filter((pool) => pool.resultat_analyse === resultat);
    if (laboratoire) filtres = filtres.filter((pool) => pool.laboratoire === laboratoire);
    return filterTrichineRows(filtres, query, (pool) =>
      [pool.reference_pool, pool.bracelets, pool.ftp_numero, pool.aliases].filter(Boolean).join(' ')
    );
  }, [pools, query, resultat, laboratoire]);

  return (
    <>
      <TrichineListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="Référence, n° de marquage, FTP"
      >
        <FiltreSelect
          label="Résultat"
          value={resultat}
          onChange={setResultat}
          options={[
            { value: '', label: 'Tous' },
            { value: 'AUCUN', label: 'Sans résultat' },
            ...optionsDe(pools, (pool) => pool.resultat_analyse).slice(1),
          ]}
        />
        <FiltreSelect
          label="Laboratoire"
          value={laboratoire}
          onChange={setLaboratoire}
          options={optionsDe(pools, (pool) => pool.laboratoire)}
        />
      </TrichineListToolbar>

      <p className="fr-text--sm text-gray-600">{rows.length} pool(s)</p>

      <TableFilterable
        data={rows}
        rowKey="id"
        noData="Aucun pool"
        columns={[
          { title: 'Référence', dataKey: 'reference_pool' },
          {
            title: 'Constitué le',
            dataKey: 'date_constitution',
            render: (pool) => dayjs(pool.date_constitution).format('DD/MM/YYYY'),
          },
          { title: 'Type', dataKey: 'type' },
          {
            title: 'Échantillons',
            dataKey: 'nb_echantillons',
            render: (pool) => (
              <span>
                {pool.nb_echantillons}
                <span className="fr-text--xs block break-words text-gray-500">{pool.bracelets}</span>
              </span>
            ),
          },
          {
            title: 'Laboratoire',
            dataKey: 'laboratoire',
            render: (pool) => (
              <span>
                {pool.laboratoire ?? '—'}
                {pool.est_lnr && (
                  <Badge
                    small
                    severity="info"
                  >
                    LNR
                  </Badge>
                )}
                {!!pool.ftp_numero && (
                  <span className="fr-text--xs block text-gray-500">{pool.ftp_numero}</span>
                )}
              </span>
            ),
          },
          {
            title: 'Résultat',
            dataKey: 'resultat_analyse',
            render: (pool) => (
              <span>
                <Resultat resultat={pool.resultat_analyse} />
                {!!pool.parasite_identifie && (
                  <span className="fr-text--xs block text-gray-500">{pool.parasite_identifie}</span>
                )}
              </span>
            ),
          },
        ]}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* FTP                                                                         */
/* -------------------------------------------------------------------------- */

function OngletFtps() {
  const [ftps, setFtps] = useState<AdminTrichineFtpRow[]>([]);
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const [laboratoire, setLaboratoire] = useState('');

  useEffect(() => {
    API.get({ path: 'admin/trichine/ftps' }).then((res) => {
      const reponse = res as AdminTrichineFtpsResponse;
      if (reponse.ok) setFtps(reponse.data.ftps);
    });
  }, []);

  const rows = useMemo(() => {
    let filtres = statut ? ftps.filter((ftp) => ftp.statut_logistique === statut) : ftps;
    if (laboratoire) filtres = filtres.filter((ftp) => ftp.laboratoire === laboratoire);
    return filterTrichineRows(filtres, query, (ftp) =>
      [ftp.numero_fiche, ftp.pools, ftp.expediteur, ftp.laboratoire].filter(Boolean).join(' ')
    );
  }, [ftps, query, statut, laboratoire]);

  return (
    <>
      <TrichineListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="N° de fiche, pool, expéditeur"
      >
        <FiltreSelect
          label="Statut"
          value={statut}
          onChange={setStatut}
          options={optionsDe(ftps, (ftp) => ftp.statut_logistique)}
        />
        <FiltreSelect
          label="Laboratoire"
          value={laboratoire}
          onChange={setLaboratoire}
          options={optionsDe(ftps, (ftp) => ftp.laboratoire)}
        />
      </TrichineListToolbar>

      <p className="fr-text--sm text-gray-600">{rows.length} fiche(s)</p>

      <TableFilterable
        data={rows}
        rowKey="id"
        noData="Aucune fiche de transmission"
        columns={[
          {
            title: 'N° de fiche',
            dataKey: 'numero_fiche',
            render: (ftp) => (
              <span>
                {ftp.numero_fiche}
                {ftp.est_confirmation && (
                  <span className="fr-text--xs block text-gray-500">confirmation</span>
                )}
              </span>
            ),
          },
          {
            title: 'Envoyée le',
            dataKey: 'date_envoi',
            render: (ftp) => (ftp.date_envoi ? dayjs(ftp.date_envoi).format('DD/MM/YYYY') : '—'),
          },
          { title: 'Expéditeur', dataKey: 'expediteur' },
          {
            title: 'Laboratoire',
            dataKey: 'laboratoire',
            render: (ftp) => (
              <span>
                {ftp.laboratoire}
                {ftp.est_lnr && (
                  <Badge
                    small
                    severity="info"
                  >
                    LNR
                  </Badge>
                )}
              </span>
            ),
          },
          {
            title: 'Pools',
            dataKey: 'nb_pools',
            render: (ftp) => (
              <span>
                {ftp.nb_pools}
                <span className="fr-text--xs block break-words text-gray-500">{ftp.pools}</span>
              </span>
            ),
          },
          {
            title: 'Statuts',
            dataKey: 'statut_logistique',
            render: (ftp) => (
              <span>
                <Badge small>{ftp.statut_logistique}</Badge>
                <span className="fr-text--xs block text-gray-500">{ftp.statut_analytique}</span>
              </span>
            ),
          },
        ]}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Échantillons                                                                */
/* -------------------------------------------------------------------------- */

function OngletEchantillons() {
  const [echantillons, setEchantillons] = useState<AdminTrichineEchantillonRow[]>([]);
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const [espece, setEspece] = useState('');

  useEffect(() => {
    API.get({ path: 'admin/trichine/echantillons' }).then((res) => {
      const reponse = res as AdminTrichineEchantillonsResponse;
      if (reponse.ok) setEchantillons(reponse.data.echantillons);
    });
  }, []);

  const rows = useMemo(() => {
    let filtres = statut ? echantillons.filter((echantillon) => echantillon.statut === statut) : echantillons;
    if (espece) filtres = filtres.filter((echantillon) => echantillon.espece === espece);
    return filterTrichineRows(filtres, query, (echantillon) =>
      [
        echantillon.reference_echantillon,
        echantillon.numero_bracelet,
        echantillon.pool_reference,
        echantillon.fei_numero,
      ]
        .filter(Boolean)
        .join(' ')
    );
  }, [echantillons, query, statut, espece]);

  return (
    <>
      <TrichineListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="Référence, n° de marquage, pool, fiche"
      >
        <FiltreSelect
          label="Statut"
          value={statut}
          onChange={setStatut}
          options={optionsDe(echantillons, (echantillon) => echantillon.statut)}
        />
        <FiltreSelect
          label="Espèce"
          value={espece}
          onChange={setEspece}
          options={optionsDe(echantillons, (echantillon) => echantillon.espece)}
        />
      </TrichineListToolbar>

      <p className="fr-text--sm text-gray-600">{rows.length} échantillon(s)</p>

      <TableFilterable
        data={rows}
        rowKey="id"
        noData="Aucun échantillon"
        columns={[
          { title: 'Référence', dataKey: 'reference_echantillon' },
          {
            title: 'Prélevé le',
            dataKey: 'date_prelevement',
            render: (echantillon) => dayjs(echantillon.date_prelevement).format('DD/MM/YYYY'),
          },
          {
            title: 'Carcasse',
            dataKey: 'numero_bracelet',
            render: (echantillon) => (
              <span>
                {echantillon.numero_bracelet ?? '—'}
                <span className="fr-text--xs block text-gray-500">
                  {[echantillon.espece, echantillon.fei_numero].filter(Boolean).join(' · ')}
                </span>
              </span>
            ),
          },
          {
            title: 'Prélèvement',
            dataKey: 'masse_grammes',
            render: (echantillon) => (
              <span>
                {echantillon.masse_grammes} g
                <span className="fr-text--xs block text-gray-500">{echantillon.site_prelevement}</span>
              </span>
            ),
          },
          {
            title: 'Pool',
            dataKey: 'pool_reference',
            render: (echantillon) => echantillon.pool_reference ?? '—',
          },
          {
            title: 'Résultat',
            dataKey: 'resultat_analyse',
            render: (echantillon) => <Resultat resultat={echantillon.resultat_analyse} />,
          },
        ]}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

const ONGLETS: TabsProps.Controlled['tabs'] = [
  { tabId: 'documents', label: 'Documents' },
  { tabId: 'pools', label: 'Pools' },
  { tabId: 'ftps', label: 'Transmissions' },
  { tabId: 'echantillons', label: 'Échantillons' },
];

export default function AdminTrichine() {
  const [onglet, setOnglet] = useState('documents');

  return (
    <div className="p-2 md:p-4">
      <title>
        Trichine | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <h1 className="fr-h3">Trichine</h1>
      <p className="fr-text--sm text-gray-600">
        Suivi de la recherche de trichine : ce qui arrive sur l'adresse de dépôt des rapports, les documents
        stockés et l'état des analyses. Listes bornées aux 200 dernières lignes.
      </p>

      <Tabs
        selectedTabId={onglet}
        tabs={ONGLETS}
        onTabChange={setOnglet}
      >
        {onglet === 'documents' && <OngletDocuments />}
        {onglet === 'pools' && <OngletPools />}
        {onglet === 'ftps' && <OngletFtps />}
        {onglet === 'echantillons' && <OngletEchantillons />}
      </Tabs>
    </div>
  );
}
