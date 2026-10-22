import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type {
  AdminHistoryEvent,
  AdminHistoryKind,
  AdminHistoryLinkType,
  AdminHistoryTimelineResponse,
} from '@api/src/types/admin-history';
import { adminActionLabel } from './admin-action-labels';
import { HISTORY_KINDS, HISTORY_SUBJECT_TYPES } from './history-labels';

const LINK_PATHS: Record<AdminHistoryLinkType, string> = {
  fei: '/app/admin/fei/',
  carcasse: '/app/admin/carcasse/',
  user: '/app/admin/user/',
  entity: '/app/admin/entity/',
};

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string')
    return ISO_TIMESTAMP.test(value) ? dayjs(value).format('DD/MM/YYYY HH:mm:ss') : value;
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function eventTitle(event: AdminHistoryEvent) {
  return event.kind === 'admin' ? adminActionLabel(event.title) : event.title;
}

function hasDetails(details: unknown) {
  if (!details || typeof details !== 'object') return false;
  return Object.values(details).some((value) => value !== null && value !== undefined);
}

function HistoryEventRow({ event }: { event: AdminHistoryEvent }) {
  const [opened, setOpened] = useState(false);
  const kind = HISTORY_KINDS.find((option) => option.value === event.kind);
  const subjectType = HISTORY_SUBJECT_TYPES.find((option) => option.value === event.subject.type)?.label;
  return (
    <li className="border-b border-gray-200 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        <span className="text-gray-500 tabular-nums">{dayjs(event.date).format('DD/MM/YYYY HH:mm:ss')}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kind?.className ?? ''}`}>
          {kind?.label ?? event.kind}
        </span>
        <span className="font-semibold">{eventTitle(event)}</span>
        {event.subject.link_type && event.subject.link_id ? (
          <span>
            <span className="text-gray-500">{subjectType} </span>
            <Link
              to={`${LINK_PATHS[event.subject.link_type]}${encodeURIComponent(event.subject.link_id)}`}
              className="text-blue-600 underline"
            >
              {event.subject.label ?? event.subject.id}
            </Link>
          </span>
        ) : null}
        <span className="text-gray-500">par {event.author_email ?? event.author_id ?? 'auteur inconnu'}</span>
        {hasDetails(event.details) && (
          <button
            type="button"
            className="text-blue-600 underline"
            aria-expanded={opened}
            onClick={() => setOpened(!opened)}
          >
            {opened ? 'Masquer' : 'Détails'}
          </button>
        )}
      </div>
      {event.changes.length > 0 && (
        <table className="mt-1 w-full border-collapse text-xs">
          <tbody>
            {event.changes.map((change) => (
              <tr
                key={change.field}
                className="align-top"
              >
                <td className="w-1/4 py-0.5 pr-2 font-mono text-gray-600">{change.field}</td>
                <td className="w-3/8 py-0.5 pr-2 break-all text-red-800 line-through decoration-red-300">
                  {formatValue(change.before)}
                </td>
                <td className="w-3/8 py-0.5 break-all text-green-800">{formatValue(change.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {opened && (
        <pre className="m-0 mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-[11px] whitespace-pre-wrap">
          {JSON.stringify(event.details, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function AdminHistoryEvents({ events }: { events: Array<AdminHistoryEvent> }) {
  if (!events.length) return <p className="mt-4 text-sm text-gray-500">Aucun événement.</p>;
  return (
    <ul className="m-0 list-none p-0">
      {events.map((event) => (
        <HistoryEventRow
          key={event.id}
          event={event}
        />
      ))}
    </ul>
  );
}

// Onglet « Historique » des pages de détail : modifications (tables d'historique), actions métier,
// notifications et actions admin, de la plus récente à la plus ancienne
export function AdminHistoryTimeline({
  type,
  id,
}: {
  type: 'fei' | 'carcasse' | 'user' | 'entity';
  id: string;
}) {
  const [data, setData] = useState<AdminHistoryTimelineResponse['data']>(null);
  const [loading, setLoading] = useState(true);
  const [kinds, setKinds] = useState<Array<AdminHistoryKind>>([]);

  useEffect(() => {
    setLoading(true);
    API.get({ path: `admin/history/${type}/${encodeURIComponent(id)}` })
      .then((res) => res as AdminHistoryTimelineResponse)
      .then((res) => {
        if (res.ok) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [type, id]);

  if (loading) return <Chargement />;
  if (!data) return <p className="text-sm text-gray-500">Historique indisponible.</p>;

  const events = kinds.length ? data.events.filter((event) => kinds.includes(event.kind)) : data.events;
  const availableKinds = HISTORY_KINDS.filter((kind) =>
    data.events.some((event) => event.kind === kind.value)
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-lg font-bold">Historique ({events.length})</h3>
        {availableKinds.map((kind) => {
          const selected = kinds.includes(kind.value);
          return (
            <button
              key={kind.value}
              type="button"
              aria-pressed={selected}
              className={`rounded-full border px-2 py-0.5 text-xs ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'}`}
              onClick={() =>
                setKinds(selected ? kinds.filter((value) => value !== kind.value) : [...kinds, kind.value])
              }
            >
              {kind.label}
            </button>
          );
        })}
      </div>
      {data.truncated && (
        <p className="mb-2 text-xs text-gray-500">
          Seuls les 1000 événements les plus récents sont affichés.
        </p>
      )}
      <AdminHistoryEvents events={events} />
    </div>
  );
}
