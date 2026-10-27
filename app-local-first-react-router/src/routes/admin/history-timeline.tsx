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
import { HistoryChanges } from './history-changes';

const LINK_PATHS: Record<AdminHistoryLinkType, string> = {
  fei: '/app/admin/fei/',
  carcasse: '/app/admin/carcasse/',
  user: '/app/admin/user/',
  entity: '/app/admin/entity/',
};

function eventTitle(event: AdminHistoryEvent) {
  return event.kind === 'admin' ? adminActionLabel(event.title) : event.title;
}

function hasDetails(details: unknown) {
  if (!details || typeof details !== 'object') return false;
  return Object.values(details).some((value) => value !== null && value !== undefined);
}

type EventGroup = { key: string; events: Array<AdminHistoryEvent> };

// Événements identiques (même minute, même auteur, mêmes changements) réunis en une ligne : une modification
// de fiche recopiée sur chacune de ses carcasses n'apparaît qu'une fois
function groupEvents(events: Array<AdminHistoryEvent>) {
  const groups = new Map<string, EventGroup>();
  for (const event of events) {
    const key = JSON.stringify([
      dayjs(event.date).format('YYYY-MM-DD HH:mm'),
      event.kind,
      event.title,
      event.author_id ?? event.author_email,
      event.subject.type,
      event.changes,
      event.details,
    ]);
    const group = groups.get(key);
    if (group) group.events.push(event);
    else groups.set(key, { key, events: [event] });
  }
  return [...groups.values()];
}

// Les événements arrivent du plus récent au plus ancien : chaque jour forme un bloc continu
function groupByDay(events: Array<AdminHistoryEvent>) {
  const days: Array<{ day: string; events: Array<AdminHistoryEvent> }> = [];
  for (const event of events) {
    const day = dayjs(event.date).format('YYYY-MM-DD');
    if (days.at(-1)?.day === day) days.at(-1)!.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}

function dayLabel(day: string) {
  if (dayjs(day).isSame(dayjs(), 'day')) return "Aujourd'hui";
  if (dayjs(day).isSame(dayjs().subtract(1, 'day'), 'day')) return 'Hier';
  return dayjs(day).format('dddd D MMMM YYYY');
}

function SubjectLink({ subject }: { subject: AdminHistoryEvent['subject'] }) {
  if (!subject.link_type || !subject.link_id) return <span>{subject.label ?? subject.id}</span>;
  return (
    <Link
      to={`${LINK_PATHS[subject.link_type]}${encodeURIComponent(subject.link_id)}`}
      className="text-blue-600 underline"
    >
      {subject.label ?? subject.id}
    </Link>
  );
}

function HistoryGroupRow({ group }: { group: EventGroup }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSubjects, setShowSubjects] = useState(false);
  const [event] = group.events;
  const kind = HISTORY_KINDS.find((option) => option.value === event.kind);
  const subjectType = HISTORY_SUBJECT_TYPES.find((option) => option.value === event.subject.type);
  const author = event.author_email ?? event.author_id;
  return (
    <li className="border-b border-gray-100 py-1.5 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className="w-10 shrink-0 text-gray-500 tabular-nums"
          title={dayjs(event.date).format('DD/MM/YYYY HH:mm:ss')}
        >
          {dayjs(event.date).format('HH:mm')}
        </span>
        <span className={`rounded-full px-1.5 text-[10px] font-semibold ${kind?.className ?? ''}`}>
          {kind?.label ?? event.kind}
        </span>
        {eventTitle(event) !== kind?.label && <span className="font-semibold">{eventTitle(event)}</span>}
        {group.events.length > 1 ? (
          <button
            type="button"
            className="text-blue-600 underline"
            aria-expanded={showSubjects}
            onClick={() => setShowSubjects(!showSubjects)}
          >
            {group.events.length} {subjectType?.plural}
          </button>
        ) : event.subject.link_type && event.subject.link_id ? (
          <span>
            <span className="text-gray-500">{subjectType?.label} </span>
            <SubjectLink subject={event.subject} />
          </span>
        ) : null}
        <span
          className="text-gray-500"
          title={author ?? undefined}
        >
          par {author ? author.split('@')[0] : 'auteur inconnu'}
        </span>
        {hasDetails(event.details) && (
          <button
            type="button"
            className="text-blue-600 underline"
            aria-expanded={showDetails}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Masquer' : 'Détails'}
          </button>
        )}
      </div>
      {showSubjects && (
        <p className="m-0 mt-0.5 ml-12 flex flex-wrap gap-x-2">
          {group.events.map((groupEvent) => (
            <SubjectLink
              key={groupEvent.id}
              subject={groupEvent.subject}
            />
          ))}
        </p>
      )}
      <HistoryChanges changes={event.changes} />
      {showDetails && (
        <pre className="m-0 mt-1 ml-12 overflow-x-auto rounded bg-gray-50 p-2 text-[11px] whitespace-pre-wrap">
          {JSON.stringify(event.details, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function AdminHistoryEvents({ events }: { events: Array<AdminHistoryEvent> }) {
  if (!events.length) return <p className="mt-4 text-sm text-gray-500">Aucun événement.</p>;
  return (
    <div>
      {groupByDay(events).map(({ day, events: dayEvents }) => (
        <section key={day}>
          <h4 className="m-0 mt-3 border-b border-gray-300 pb-1 text-sm font-bold first-letter:uppercase">
            {dayLabel(day)}
          </h4>
          <ul className="m-0 list-none p-0">
            {groupEvents(dayEvents).map((group) => (
              <HistoryGroupRow
                key={group.key}
                group={group}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
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
