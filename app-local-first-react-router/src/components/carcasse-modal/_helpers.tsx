import { type ReactNode } from 'react';
import dayjs from 'dayjs';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import type { Carcasse, CarcasseIntermediaire } from '@prisma/client';
import { UserRoles } from '@prisma/client';
import type useZustandStore from '@app/zustand/store';
import type { CardAccent } from '@app/utils/get-carcasse-card-display';

type DecisionColor = {
  cardText: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
};

export function getAccentColorClasses(accent: CardAccent | undefined): DecisionColor {
  switch (accent) {
    case 'red':
      return {
        cardText: 'text-red-700',
        cardBg: 'bg-red-50',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-800',
      };
    case 'blue':
      return {
        cardText: 'text-blue-700',
        cardBg: 'bg-blue-50',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800',
      };
    case 'orange':
      return {
        cardText: 'text-orange-700',
        cardBg: 'bg-orange-50',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
      };
    case 'gray':
    default:
      return {
        cardText: 'text-gray-700',
        cardBg: 'bg-gray-50',
        badgeBg: 'bg-gray-100',
        badgeText: 'text-gray-800',
      };
  }
}

export function formatModalDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YY');
}

export function formatModalTimelineDate(date: Date, withTime?: boolean): string {
  return dayjs(date).format(withTime ? 'dddd D MMMM YYYY à HH:mm' : 'dddd D MMMM YYYY');
}

export function ModalStatusBadge({
  statusLabel,
  statusIconId,
  accentColor,
}: {
  statusLabel: string;
  statusIconId: string | null;
  accentColor: CardAccent;
}) {
  const colors = getAccentColorClasses(accentColor);
  return (
    <div className="fr-mb-2w flex flex-wrap items-center gap-2">
      <Tag
        small
        className={['items-center rounded-[4px] font-semibold', colors.badgeBg, colors.badgeText].join(' ')}
      >
        {statusIconId && (
          <span
            className={[statusIconId, 'fr-icon--sm mr-1'].join(' ')}
            aria-hidden="true"
          />
        )}
        {statusLabel}
      </Tag>
    </div>
  );
}

export function ModalCard({
  title,
  accentColor,
  children,
}: {
  title?: string;
  accentColor?: CardAccent;
  children: ReactNode;
}) {
  const isAccented = !!accentColor && accentColor !== 'gray';
  const colors = isAccented ? getAccentColorClasses(accentColor) : null;
  return (
    <div className={['fr-mb-2w rounded p-4 md:p-6', colors ? colors.cardBg : 'bg-gray-50'].join(' ')}>
      {title && (
        <h3 className={['fr-h6 fr-mb-1w', colors ? colors.cardText : ''].filter(Boolean).join(' ')}>
          {title}
        </h3>
      )}
      <div className={colors ? colors.cardText : ''}>{children}</div>
    </div>
  );
}

export function ModalActeurBlock({
  label,
  lines,
}: {
  label: string;
  lines: Array<string | null | undefined>;
}) {
  const cleaned = lines.map((l) => (l ?? '').toString().trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <ul className="space-y-0.5 text-sm">
        {cleaned.map((line, idx) => (
          <li key={idx}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export type ModalTimelineEvent = { date: Date; label: string; withTime?: boolean };

export function buildModalTimeline(args: {
  fei: ReturnType<typeof useZustandStore.getState>['feis'][string] | undefined;
  carcasse: Carcasse;
  intermediaires: Array<CarcasseIntermediaire>;
  entities: ReturnType<typeof useZustandStore.getState>['entities'];
}): Array<ModalTimelineEvent> {
  const { fei, carcasse, intermediaires, entities } = args;
  const events: Array<ModalTimelineEvent> = [];

  if (fei?.date_mise_a_mort) {
    events.push({ date: new Date(fei.date_mise_a_mort), label: 'Mise à mort' });
  }
  if (fei?.examinateur_initial_date_approbation_mise_sur_le_marche) {
    events.push({
      date: new Date(fei.examinateur_initial_date_approbation_mise_sur_le_marche),
      label: 'Fiche transmise au premier détenteur',
      withTime: true,
    });
  }
  if (fei?.premier_detenteur_depot_ccg_at) {
    const ccgName =
      entities[fei.premier_detenteur_depot_entity_id ?? '']?.nom_d_usage ||
      fei.premier_detenteur_depot_entity_name_cache ||
      '';
    events.push({
      date: new Date(fei.premier_detenteur_depot_ccg_at),
      label: ccgName ? `Dépôt des carcasses ${ccgName}` : 'Dépôt des carcasses',
      withTime: true,
    });
  }
  for (const ci of intermediaires) {
    if (!ci.prise_en_charge_at) continue;
    const entityName = entities[ci.intermediaire_entity_id]?.nom_d_usage ?? '';
    const isEtg = ci.intermediaire_role === UserRoles.ETG;
    events.push({
      date: new Date(ci.prise_en_charge_at),
      label: isEtg ? `Prise en charge par ETG ${entityName}` : `Carcasses prise en charge par ${entityName}`,
      withTime: true,
    });
  }
  if (carcasse.svi_assigned_to_fei_at) {
    events.push({
      date: new Date(carcasse.svi_assigned_to_fei_at),
      label: 'Assignation au service vétérinaire',
      withTime: true,
    });
  }
  if (carcasse.svi_ipm2_date) {
    events.push({
      date: new Date(carcasse.svi_ipm2_date),
      label: 'Inspection du service vétérinaire',
    });
  }
  if (carcasse.svi_carcasse_status_set_at) {
    events.push({
      date: new Date(carcasse.svi_carcasse_status_set_at),
      label: 'Contrôle par service vétérinaire',
      withTime: true,
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function ModalTimeline({ events }: { events: Array<ModalTimelineEvent> }) {
  if (events.length === 0) return <p className="text-sm text-gray-500">Aucun événement à afficher.</p>;
  return (
    <div className="relative border-l-2 border-gray-300 pl-4">
      {events.map((event, i) => (
        <div
          key={`${event.date.toISOString()}-${i}`}
          className="relative mb-4 last:mb-0"
        >
          <div className="absolute top-1 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" />
          <div className="text-sm">
            <span className="text-gray-500">{formatModalTimelineDate(event.date, event.withTime)}</span>{' '}
            <span className="font-semibold">{event.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
