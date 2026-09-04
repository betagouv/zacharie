import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import dayjs from 'dayjs';
import type { EmailEntrant } from '@prisma/client';
import type {
  AdminEmailEntrantResponse,
  AdminEmailsEntrantsResponse,
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
 * Vue d'ensemble trichine pour l'admin : ce qui arrive par email, ce qui est stocké, et l'état
 * des analyses. Les listes sont bornées aux plus récentes côté serveur, les filtres sont locaux.
 */

const STATUT_EMAIL_LABELS: Record<string, string> = {
  A_ANALYSER: 'À analyser',
  TRAITE: 'Traité',
  IGNORE: 'Ignoré',
  ERREUR: 'Erreur',
};

const STATUT_EMAIL_SEVERITY: Record<string, 'success' | 'error' | 'info' | undefined> = {
  A_ANALYSER: 'info',
  TRAITE: 'success',
  IGNORE: undefined,
  ERREUR: 'error',
};

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
/* Emails entrants                                                             */
/* -------------------------------------------------------------------------- */

function OngletEmails() {
  const [emails, setEmails] = useState<EmailEntrant[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const [selectionne, setSelectionne] = useState<EmailEntrant | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const res = (await API.get({ path: 'admin/trichine/emails-entrants' })) as AdminEmailsEntrantsResponse;
    if (res.ok) {
      setEmails(res.data.emails);
      setTotal(res.data.total);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function remplacer(email: EmailEntrant) {
    setEmails((liste) => liste.map((item) => (item.id === email.id ? email : item)));
    setSelectionne((courant) => (courant?.id === email.id ? email : courant));
  }

  async function relancerAnalyse(email: EmailEntrant) {
    setEnCours(email.id);
    setMessage(null);
    const res = (await API.post({
      path: `admin/trichine/emails-entrants/${email.id}/analyser`,
    })) as AdminEmailEntrantResponse;
    setEnCours(null);
    if (!res.ok || !res.data?.email) {
      setMessage(res.error || "L'analyse a échoué");
      return;
    }
    remplacer(res.data.email);
    const lus = (res.data.ocr ?? []).filter((document) => document.texte_lu).length;
    setMessage(`Analyse relancée : ${lus} document(s) lu(s) sur ${(res.data.ocr ?? []).length}.`);
  }

  async function changerStatut(email: EmailEntrant, nouveauStatut: string) {
    setEnCours(email.id);
    setMessage(null);
    const res = (await API.put({
      path: `admin/trichine/emails-entrants/${email.id}/statut`,
      body: { statut: nouveauStatut },
    })) as AdminEmailEntrantResponse;
    setEnCours(null);
    if (!res.ok || !res.data?.email) {
      setMessage(res.error || 'Le statut n’a pas pu être changé');
      return;
    }
    remplacer(res.data.email);
    setMessage(`Statut passé à ${STATUT_EMAIL_LABELS[nouveauStatut] ?? nouveauStatut}.`);
  }

  const rows = useMemo(() => {
    const filtres = statut ? emails.filter((email) => email.statut === statut) : emails;
    return filterTrichineRows(filtres, query, (email) =>
      [email.expediteur, email.sujet, email.message_id].filter(Boolean).join(' ')
    );
  }, [emails, query, statut]);

  return (
    <>
      <TrichineListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="Expéditeur, sujet, Message-ID"
      >
        <FiltreSelect
          label="Statut"
          value={statut}
          onChange={setStatut}
          options={[
            { value: '', label: 'Tous' },
            ...Object.entries(STATUT_EMAIL_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </TrichineListToolbar>

      {!!message && (
        <Alert
          className="fr-mb-2w"
          severity="info"
          small
          description={message}
        />
      )}
      <p className="fr-text--sm text-gray-600">
        {rows.length} message(s) affiché(s) — {total} au total
      </p>

      <TableFilterable
        data={rows}
        rowKey="id"
        noData="Aucun message reçu"
        columns={[
          {
            title: 'Reçu le',
            dataKey: 'recu_at',
            render: (email) => dayjs(email.recu_at).format('DD/MM/YYYY HH:mm'),
          },
          {
            title: 'Expéditeur',
            dataKey: 'expediteur',
            render: (email) => (
              <span className="break-all">
                {email.expediteur || '—'}
                {!email.laboratoire_reconnu && (
                  <span className="fr-text--xs block text-gray-500">laboratoire non reconnu</span>
                )}
              </span>
            ),
          },
          {
            title: 'Sujet',
            dataKey: 'sujet',
            render: (email) => (
              <span className="break-words">
                {email.sujet || '—'}
                {!!email.motif_ignore && (
                  <span className="fr-text--xs block text-gray-500">écarté : {email.motif_ignore}</span>
                )}
              </span>
            ),
          },
          { title: 'PJ', dataKey: 'nb_pieces_jointes' },
          {
            title: 'Statut',
            dataKey: 'statut',
            render: (email) => (
              <Badge
                small
                severity={STATUT_EMAIL_SEVERITY[email.statut]}
              >
                {STATUT_EMAIL_LABELS[email.statut] ?? email.statut}
              </Badge>
            ),
          },
          {
            title: 'Actions',
            dataKey: 'id',
            render: (email) => (
              <div className="flex flex-col items-start gap-1">
                <Button
                  priority="tertiary no outline"
                  size="small"
                  onClick={() => setSelectionne(selectionne?.id === email.id ? null : email)}
                >
                  {selectionne?.id === email.id ? 'Masquer' : 'Détail'}
                </Button>
                <Button
                  priority="tertiary no outline"
                  size="small"
                  disabled={enCours === email.id}
                  onClick={() => relancerAnalyse(email)}
                >
                  {enCours === email.id ? 'Analyse…' : 'Relancer l’analyse'}
                </Button>
              </div>
            ),
          },
        ]}
      />

      {!!selectionne && (
        <div className="fr-callout fr-mt-2w">
          <h2 className="fr-callout__title fr-h6 break-words">{selectionne.sujet || 'Sans sujet'}</h2>
          <div className="fr-callout__text fr-text--sm">
            <p className="break-all">
              <strong>Message-ID</strong> : {selectionne.message_id}
              <br />
              <strong>Destinataires</strong> : {selectionne.destinataires.join(', ') || '—'}
              <br />
              <strong>Score spam</strong> : {selectionne.spam_score ?? '—'}
              <br />
              <strong>UUID Brevo</strong> : {selectionne.brevo_uuid || '—'}
            </p>

            <div className="fr-mb-2w flex flex-wrap items-end gap-4">
              <FiltreSelect
                label="Changer le statut"
                value={selectionne.statut}
                onChange={(valeur) => changerStatut(selectionne, valeur)}
                options={Object.entries(STATUT_EMAIL_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>

            <p className="fr-text--xs text-gray-600">
              Détail de l'ingestion et de l'OCR, tel qu'enregistré au traitement :
            </p>
            <pre className="fr-text--xs max-h-96 overflow-auto bg-gray-50 p-2">
              {JSON.stringify(selectionne.detail, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

function OngletDocuments() {
  const [documents, setDocuments] = useState<AdminTrichineDocumentRow[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [rattachement, setRattachement] = useState('');
  const [texte, setTexte] = useState<{ nom: string; contenu: string } | null>(null);

  useEffect(() => {
    API.get({ path: 'admin/trichine/documents' }).then((res) => {
      const reponse = res as AdminTrichineDocumentsResponse;
      if (reponse.ok) setDocuments(reponse.data.documents);
    });
  }, []);

  const rows = useMemo(() => {
    let filtres = source ? documents.filter((document) => document.source === source) : documents;
    if (rattachement === 'NON_RATTACHE') {
      filtres = filtres.filter((document) => !document.pool_reference && !document.ftp_numero);
    } else if (rattachement) {
      filtres = filtres.filter((document) => document.rattachement_indice === rattachement);
    }
    return filterTrichineRows(filtres, query, (document) =>
      [document.nom_fichier, document.pool_reference, document.ftp_numero, document.email_expediteur]
        .filter(Boolean)
        .join(' ')
    );
  }, [documents, query, source, rattachement]);

  const nonRattaches = documents.filter(
    (document) => !document.pool_reference && !document.ftp_numero
  ).length;

  async function voirTexte(document: AdminTrichineDocumentRow) {
    const res = (await API.get({ path: `admin/trichine/document/${document.id}/texte` })) as {
      ok: boolean;
      data: { document: { nom_fichier: string | null; texte_extrait: string | null } };
    };
    if (res.ok) {
      setTexte({
        nom: res.data.document.nom_fichier ?? 'document',
        contenu: res.data.document.texte_extrait ?? 'Aucun texte lu dans ce document.',
      });
    }
  }

  return (
    <>
      <TrichineListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="Nom de fichier, pool, FTP, expéditeur"
      >
        <FiltreSelect
          label="Provenance"
          value={source}
          onChange={setSource}
          options={optionsDe(documents, (document) => document.source)}
        />
        <FiltreSelect
          label="Rattachement"
          value={rattachement}
          onChange={setRattachement}
          options={[
            { value: '', label: 'Tous' },
            { value: 'NON_RATTACHE', label: `Non rattachés (${nonRattaches})` },
            ...optionsDe(documents, (document) => document.rattachement_indice).slice(1),
          ]}
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
            title: 'Provenance',
            dataKey: 'source',
            render: (document) => (
              <span>
                {document.source}
                {!!document.email_expediteur && (
                  <span className="fr-text--xs block break-all text-gray-500">
                    {document.email_expediteur}
                  </span>
                )}
              </span>
            ),
          },
          {
            title: 'Rattaché à',
            dataKey: 'pool_reference',
            render: (document) => (
              <span>
                {document.pool_reference || document.ftp_numero || (
                  <Badge
                    small
                    severity="warning"
                  >
                    non rattaché
                  </Badge>
                )}
                {!!document.rattachement_indice && (
                  <span className="fr-text--xs block text-gray-500">{document.rattachement_indice}</span>
                )}
              </span>
            ),
          },
          {
            title: 'Texte lu',
            dataKey: 'longueur_texte',
            render: (document) =>
              document.longueur_texte ? (
                <Button
                  priority="tertiary no outline"
                  size="small"
                  onClick={() => voirTexte(document)}
                >
                  {document.texte_source} ({document.longueur_texte} car.)
                </Button>
              ) : (
                '—'
              ),
          },
        ]}
      />

      {!!texte && (
        <div className="fr-callout fr-mt-2w">
          <h2 className="fr-callout__title fr-h6 break-words">{texte.nom}</h2>
          <div className="fr-callout__text">
            <Button
              priority="tertiary no outline"
              size="small"
              onClick={() => setTexte(null)}
            >
              Masquer
            </Button>
            <pre className="fr-text--xs max-h-96 overflow-auto bg-gray-50 p-2 whitespace-pre-wrap">
              {texte.contenu}
            </pre>
          </div>
        </div>
      )}
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
      [pool.reference_pool, pool.bracelets, pool.ftp_numero, pool.reference_labo].filter(Boolean).join(' ')
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

const ONGLETS: TabsProps['tabs'] = [
  { tabId: 'emails', label: 'Emails entrants' },
  { tabId: 'documents', label: 'Documents' },
  { tabId: 'pools', label: 'Pools' },
  { tabId: 'ftps', label: 'Transmissions' },
  { tabId: 'echantillons', label: 'Échantillons' },
];

export default function AdminTrichine() {
  const [onglet, setOnglet] = useState('emails');

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
        {onglet === 'emails' && <OngletEmails />}
        {onglet === 'documents' && <OngletDocuments />}
        {onglet === 'pools' && <OngletPools />}
        {onglet === 'ftps' && <OngletFtps />}
        {onglet === 'echantillons' && <OngletEchantillons />}
      </Tabs>
    </div>
  );
}
