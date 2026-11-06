import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import DateRangeFilterSection from '@app/components/DateRangeFilterSection';
import type { AdminAuditLogResponse, AdminAuditLogRow } from '@api/src/types/responses';
import { adminActionLabel as actionLabel } from './admin-action-labels';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import AdminViews, { type AdminView } from './admin-views';
import { toApiQuery, useDebouncedUrlText, usePageOffset, useUrlFilters, useUrlList } from './use-url-filters';

type AuditLogData = NonNullable<AdminAuditLogResponse['data']>;

const LIMIT = 100;
const CONNECT_AS_ACTION = 'POST /user/connect-as';

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
  const [loading, setLoading] = useState(true);
  const [openedLogId, setOpenedLogId] = useState<string | null>(null);
  const user = useMostFreshUser('AdminAuditLog');
  const { searchParams, setFilters, replaceFilters } = useUrlFilters();
  const offset = usePageOffset(searchParams, LIMIT);
  const adminIds = useUrlList(searchParams, 'admin_user_ids');
  const targetTypes = useUrlList(searchParams, 'target_types');
  const actions = useUrlList(searchParams, 'actions');
  const urlTargetId = searchParams.get('target_id') ?? '';
  const [targetId, setTargetId] = useDebouncedUrlText(urlTargetId, (value) =>
    setFilters({ target_id: value }, { replace: true })
  );
  const dateFrom = searchParams.get('created_at_from') ?? '';
  const dateTo = searchParams.get('created_at_to') ?? '';
  const queryString = searchParams.toString();

  useEffect(() => {
    setLoading(true);
    const query = toApiQuery(new URLSearchParams(queryString), LIMIT, offset);
    API.get({ path: 'admin/audit-log', query })
      .then((res) => res as AdminAuditLogResponse)
      .then((res) => {
        if (res.ok && res.data) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [queryString, offset]);

  const views: Array<AdminView> = [
    { label: 'Tout', params: {} },
    { label: 'Connexions « en tant que »', params: { actions: CONNECT_AS_ACTION } },
    ...(user ? [{ label: 'Mes actions', params: { admin_user_ids: user.id } }] : []),
  ];

  const activeFilterCount =
    adminIds.length +
    targetTypes.length +
    actions.length +
    (urlTargetId ? 1 : 0) +
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
        onReset={() => replaceFilters({})}
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
          onChange={(from, to) => setFilters({ created_at_from: from, created_at_to: to })}
        />
        <CheckboxFilterSection
          title="Admin"
          options={(data?.admins ?? []).map((admin) => ({ value: admin.id, label: admin.email }))}
          selected={adminIds}
          onChange={(next) => setFilters({ admin_user_ids: next })}
        />
        <CheckboxFilterSection
          title="Type de cible"
          options={TARGET_TYPES}
          selected={targetTypes}
          onChange={(next) => setFilters({ target_types: next })}
        />
        <CheckboxFilterSection
          title="Action"
          scroll
          defaultOpen={false}
          options={(data?.actions ?? []).map((action) => ({ value: action, label: actionLabel(action) }))}
          selected={actions}
          onChange={(next) => setFilters({ actions: next })}
        />
      </FiltersSidebar>
      <div className="min-w-0 flex-1 py-4 md:px-4">
        <AdminViews views={views} />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Journal admin ({total})</h3>
          <div className="flex items-center gap-2">
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset === 0}
              onClick={() => setFilters({ page: offset - LIMIT > 0 ? String(offset / LIMIT) : null })}
            >
              Précédent
            </button>
            <span className="text-sm tabular-nums">
              {total ? offset + 1 : 0}–{Math.min(offset + LIMIT, total)} / {total}
            </span>
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset + LIMIT >= total}
              onClick={() => setFilters({ page: String(offset / LIMIT + 2) })}
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
