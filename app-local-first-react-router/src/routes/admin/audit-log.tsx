import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import DateRangeFilterSection from '@app/components/DateRangeFilterSection';
import type { AdminAuditLogResponse, AdminAuditLogRow } from '@api/src/types/responses';

type AuditLogData = NonNullable<AdminAuditLogResponse['data']>;

const ACTION_LABELS: Record<string, string> = {
  'POST /user/connect-as': 'Connexion en tant que',
  'POST /user/nouveau': 'Création d’utilisateur',
  'POST /user/:user_id': 'Modification d’utilisateur',
  'POST /user/:user_id/soft-delete': 'Suppression d’utilisateur',
  'POST /user/:user_id/restore': 'Restauration d’utilisateur',
  'POST /user/:user_id/unblock': 'Déblocage de la connexion',
  'POST /user/:user_id/invitation-link': 'Lien d’invitation généré',
  'POST /user/:user_id/send-reset-password': 'Réinitialisation du mot de passe envoyée',
  'POST /user-entity': 'Rattachement à une entité',
  'PUT /user-entity': 'Changement de statut dans une entité',
  'DELETE /user-entity': 'Retrait d’une entité',
  'POST /entity/nouvelle': 'Création d’entité',
  'POST /entity/:entity_id': 'Modification d’entité',
  'POST /entity/:entity_id/soft-delete': 'Suppression d’entité',
  'POST /entity/:entity_id/restore': 'Restauration d’entité',
  'POST /entity-dedicated-api-key/:entity_id': 'Clé API dédiée à une entité',
  'POST /fei/:fei_numero/soft-delete': 'Suppression de fiche',
  'POST /carcasse/:zacharie_carcasse_id/soft-delete': 'Suppression de carcasse',
  'POST /api-key/nouvelle': 'Création de clé API',
  'POST /api-key/new-access-token/:id': 'Nouveau jeton de clé API',
  'POST /api-key-approval': 'Approbation de clé API',
  'POST /ccg/import': 'Import de CCG',
  'POST /bug-resolution': 'Nouvelle enquête de bug',
  'POST /bug-resolution/:id/message': 'Message à Albert',
};

const TARGET_TYPES: Array<{ value: string; label: string }> = [
  { value: 'user', label: 'Utilisateur' },
  { value: 'entity', label: 'Entité' },
  { value: 'fei', label: 'Fiche' },
  { value: 'carcasse', label: 'Carcasse' },
  { value: 'api_key', label: 'Clé API' },
  { value: 'bug_investigation', label: 'Enquête de bug' },
];

const TARGET_PATHS: Record<string, string> = {
  user: '/app/admin/user/',
  entity: '/app/admin/entity/',
  fei: '/app/admin/fei/',
  carcasse: '/app/admin/carcasse/',
  api_key: '/app/admin/api-key/',
  bug_investigation: '/app/admin/bug-resolution/',
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function TargetCell({ log }: { log: AdminAuditLogRow }) {
  if (!log.target_type || !log.target_id) return <>—</>;
  const type = TARGET_TYPES.find((option) => option.value === log.target_type)?.label ?? log.target_type;
  return (
    <>
      <span className="text-gray-500">{type} · </span>
      <Link
        to={`${TARGET_PATHS[log.target_type]}${encodeURIComponent(log.target_id)}`}
        className="text-blue-600 underline"
      >
        {log.target_label ?? log.target_id}
      </Link>
    </>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div className="min-w-0">
      <p className="m-0 mb-1 font-semibold">{title}</p>
      <pre className="m-0 overflow-x-auto rounded bg-white p-2 text-[11px] whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function AdminAuditLog() {
  const [data, setData] = useState<AuditLogData | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openedLogId, setOpenedLogId] = useState<string | null>(null);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [targetTypes, setTargetTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [targetId, setTargetId] = useState('');
  const [debouncedTargetId, setDebouncedTargetId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 100;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedTargetId(targetId);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [targetId]);

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (adminIds.length) query.admin_user_ids = adminIds.join(',');
    if (targetTypes.length) query.target_types = targetTypes.join(',');
    if (actions.length) query.actions = actions.join(',');
    if (debouncedTargetId) query.target_id = debouncedTargetId;
    if (dateFrom) query.created_at_from = dateFrom;
    if (dateTo) query.created_at_to = dateTo;
    API.get({ path: 'admin/audit-log', query })
      .then((res) => res as AdminAuditLogResponse)
      .then((res) => {
        if (res.ok && res.data) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [offset, adminIds, targetTypes, actions, debouncedTargetId, dateFrom, dateTo]);

  const activeFilterCount =
    adminIds.length +
    targetTypes.length +
    actions.length +
    (targetId ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  if (loading && !data) {
    return <Chargement />;
  }

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="md:-ml-4 md:flex">
      <title>
        Journal admin | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <FiltersSidebar
        storageKey="admin-audit-log-filters"
        activeFilterCount={activeFilterCount}
        onReset={() => {
          setAdminIds([]);
          setTargetTypes([]);
          setActions([]);
          setTargetId('');
          setDateFrom('');
          setDateTo('');
          setOffset(0);
        }}
      >
        <input
          type="search"
          placeholder="Identifiant de la cible..."
          aria-label="Identifiant de la cible"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <DateRangeFilterSection
          title="Date"
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Admin"
          options={(data?.admins ?? []).map((admin) => ({ value: admin.id, label: admin.email }))}
          selected={adminIds}
          onChange={(next) => {
            setAdminIds(next);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Type de cible"
          options={TARGET_TYPES}
          selected={targetTypes}
          onChange={(next) => {
            setTargetTypes(next);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Action"
          scroll
          defaultOpen={false}
          options={(data?.actions ?? []).map((action) => ({ value: action, label: actionLabel(action) }))}
          selected={actions}
          onChange={(next) => {
            setActions(next);
            setOffset(0);
          }}
        />
      </FiltersSidebar>
      <div className="min-w-0 flex-1 py-4 md:px-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Journal admin ({total})</h3>
          <div className="flex items-center gap-2">
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Précédent
            </button>
            <span className="text-sm tabular-nums">
              {total ? offset + 1 : 0}–{Math.min(offset + limit, total)} / {total}
            </span>
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Suivant
            </button>
          </div>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-gray-100 text-left">
              <th className="p-1">date</th>
              <th className="p-1">admin</th>
              <th className="p-1">action</th>
              <th className="p-1">cible</th>
              <th className="p-1">résultat</th>
              <th className="p-1">
                <span className="sr-only">détails</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const opened = openedLogId === log.id;
              return (
                <Fragment key={log.id}>
                  <tr className="border-b hover:bg-blue-50">
                    <td className="p-1 whitespace-nowrap">
                      {dayjs(log.created_at).format('DD/MM/YYYY HH:mm:ss')}
                    </td>
                    <td className="max-w-[180px] truncate p-1">{log.admin_email ?? log.admin_user_id}</td>
                    <td
                      className="p-1"
                      title={log.action}
                    >
                      {actionLabel(log.action)}
                    </td>
                    <td className="max-w-[240px] truncate p-1">
                      <TargetCell log={log} />
                    </td>
                    <td className="p-1">
                      {log.status_code < 400 ? (
                        <span className="text-green-700">OK</span>
                      ) : (
                        <span className="text-red-700">Échec ({log.status_code})</span>
                      )}
                    </td>
                    <td className="p-1 text-right">
                      <button
                        type="button"
                        className="text-blue-600 underline"
                        aria-expanded={opened}
                        onClick={() => setOpenedLogId(opened ? null : log.id)}
                      >
                        {opened ? 'Masquer' : 'Détails'}
                      </button>
                    </td>
                  </tr>
                  {opened && (
                    <tr className="border-b bg-gray-50">
                      <td
                        colSpan={6}
                        className="p-2"
                      >
                        <div className="grid gap-2 md:grid-cols-2">
                          <JsonBlock
                            title="Avant"
                            value={log.before}
                          />
                          <JsonBlock
                            title="Après"
                            value={log.after}
                          />
                          <JsonBlock
                            title="Données envoyées"
                            value={log.body}
                          />
                          <JsonBlock
                            title="Paramètres"
                            value={log.params}
                          />
                        </div>
                        <p className="m-0 mt-2 text-gray-500">
                          {log.ip ?? 'IP inconnue'} · {log.user_agent ?? 'navigateur inconnu'}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!logs.length && (
          <p className="mt-4 text-sm text-gray-500">Aucune action ne correspond aux filtres.</p>
        )}
      </div>
    </div>
  );
}
