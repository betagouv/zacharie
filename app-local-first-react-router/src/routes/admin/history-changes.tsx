import { useState } from 'react';
import dayjs from 'dayjs';
import type { UserRoles } from '@prisma/client';
import type { AdminHistoryChange } from '@api/src/types/admin-history';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';

// Au-delà, les lignes d'un événement sont repliées
const VISIBLE_ROWS = 3;

// Champs qui décrivent ensemble un même détenteur : affichés sur une ligne « nom (rôle) »
type FieldGroup = { label: string; names: Array<string>; ids: Array<string>; role?: string };

const FIELD_GROUPS: Array<FieldGroup> = [
  {
    label: 'Détenteur actuel',
    names: ['current_owner_entity_name_cache', 'current_owner_user_name_cache'],
    ids: ['current_owner_entity_id', 'current_owner_user_id'],
    role: 'current_owner_role',
  },
  {
    label: 'Prochain détenteur',
    names: ['next_owner_entity_name_cache', 'next_owner_user_name_cache'],
    ids: ['next_owner_entity_id', 'next_owner_user_id'],
    role: 'next_owner_role',
  },
  {
    label: 'Détenteur précédent',
    names: [],
    ids: ['prev_owner_entity_id', 'prev_owner_user_id'],
    role: 'prev_owner_role',
  },
  {
    label: 'Premier détenteur',
    names: ['premier_detenteur_name_cache'],
    ids: ['premier_detenteur_entity_id', 'premier_detenteur_user_id'],
  },
  {
    label: 'Lieu de dépôt',
    names: ['premier_detenteur_depot_entity_name_cache'],
    ids: ['premier_detenteur_depot_entity_id'],
  },
  {
    label: 'Destinataire choisi par le premier détenteur',
    names: [],
    ids: ['premier_detenteur_prochain_detenteur_id_cache'],
    role: 'premier_detenteur_prochain_detenteur_role_cache',
  },
  {
    label: "Destinataire choisi par l'intermédiaire",
    names: [],
    ids: ['intermediaire_prochain_detenteur_id_cache'],
    role: 'intermediaire_prochain_detenteur_role_cache',
  },
  { label: 'Vétérinaire IPM1', names: ['svi_ipm1_user_name_cache'], ids: ['svi_ipm1_user_id'] },
  { label: 'Vétérinaire IPM2', names: ['svi_ipm2_user_name_cache'], ids: ['svi_ipm2_user_id'] },
];

const FIELD_LABELS: Record<string, string> = {
  deleted_at: 'Supprimé le',
  prise_en_charge_at: 'Prise en charge le',
  prise_en_charge: 'Prise en charge',
  decision_at: 'Décision le',
  refus: 'Refus',
  manquante: 'Manquante',
  commentaire: 'Commentaire',
  intermediaire_depot_type: 'Type de dépôt',
  intermediaire_poids: 'Poids',
  premier_detenteur_depot_type: 'Type de dépôt',
  premier_detenteur_depot_ccg_at: 'Dépôt au CCG le',
  premier_detenteur_transport_type: 'Transport',
  premier_detenteur_transport_date: 'Transport le',
  examinateur_signed_at: "Signé par l'examinateur le",
  examinateur_initial_approbation_mise_sur_le_marche: 'Mise sur le marché approuvée',
  examinateur_initial_date_approbation_mise_sur_le_marche: 'Mise sur le marché approuvée le',
  examinateur_anomalies_carcasse: 'Anomalies carcasse',
  examinateur_anomalies_abats: 'Anomalies abats',
  intermediaire_carcasse_refus_motif: 'Motif de refus',
  intermediaire_carcasse_manquante: 'Carcasse manquante',
  svi_carcasse_status: 'Statut SVI',
  svi_carcasse_status_set_at: 'Statut SVI fixé le',
  numero_bracelet: 'Numéro de bracelet',
  prenom: 'Prénom',
  nom_de_famille: 'Nom',
};

// Nom technique rendu lisible : premier_detenteur_depot_ccg_at → « Premier detenteur depot ccg »
function fieldLabel(field: string) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const words = field.replace(/_(cache|at)$/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENUM = /^[A-Z][A-Z0-9_]*$/;

type DisplayValue = { text: string; title?: string } | null;

function enumLabel(value: string) {
  // sigles (ETG, SVI, CCG) laissés tels quels
  if (value.length <= 4 && !value.includes('_')) return value;
  const roleLabel = getUserRoleLabel(value as UserRoles);
  if (roleLabel !== 'Inconnu') return roleLabel;
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function displayValue(value: unknown): DisplayValue {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    const texts = value.map(displayValue).filter((item) => item !== null);
    return texts.length ? { text: texts.map((item) => item.text).join(', ') } : null;
  }
  if (typeof value === 'boolean') return { text: value ? 'Oui' : 'Non' };
  if (typeof value === 'object') return { text: JSON.stringify(value) };
  const text = String(value);
  if (ISO_TIMESTAMP.test(text)) {
    const date = dayjs(text);
    return {
      text: date.format(date.isSame(dayjs(), 'year') ? 'DD/MM HH:mm' : 'DD/MM/YYYY HH:mm'),
      title: date.format('DD/MM/YYYY HH:mm:ss'),
    };
  }
  if (UUID.test(text)) return { text: `${text.slice(0, 8)}…`, title: text };
  if (ENUM.test(text)) return { text: enumLabel(text), title: text };
  return { text };
}

function groupValue(group: FieldGroup, values: Record<string, unknown>): DisplayValue {
  const name = group.names.map((field) => values[field]).find((value) => value);
  const id = group.ids.map((field) => values[field]).find((value) => value);
  const who = name ? { text: String(name), title: id ? String(id) : undefined } : displayValue(id);
  const role = group.role ? displayValue(values[group.role]) : null;
  if (!who) return role;
  return role ? { text: `${who.text} (${role.text})`, title: who.title } : who;
}

type Row = { key: string; label: string; fields: Array<string>; before: DisplayValue; after: DisplayValue };

function buildRows(changes: Array<AdminHistoryChange>): Array<Row> {
  const before = Object.fromEntries(changes.map((change) => [change.field, change.before]));
  const after = Object.fromEntries(changes.map((change) => [change.field, change.after]));
  const grouped = new Set<string>();
  const rows: Array<Row> = [];
  for (const group of FIELD_GROUPS) {
    const fields = [...group.names, ...group.ids, ...(group.role ? [group.role] : [])];
    const changed = fields.filter((field) => field in after);
    if (!changed.length) continue;
    changed.forEach((field) => grouped.add(field));
    rows.push({
      key: group.label,
      label: group.label,
      fields: changed,
      before: groupValue(group, before),
      after: groupValue(group, after),
    });
  }
  for (const change of changes) {
    if (grouped.has(change.field)) continue;
    rows.push({
      key: change.field,
      label: fieldLabel(change.field),
      fields: [change.field],
      before: displayValue(change.before),
      after: displayValue(change.after),
    });
  }
  return rows;
}

function Value({ value }: { value: DisplayValue }) {
  return <span title={value?.title}>{value?.text ?? '—'}</span>;
}

export function HistoryChanges({ changes }: { changes: Array<AdminHistoryChange> }) {
  const [showAll, setShowAll] = useState(false);
  if (!changes.length) return null;
  const rows = buildRows(changes);
  const visibleRows = showAll ? rows : rows.slice(0, VISIBLE_ROWS);
  const hiddenRows = rows.length - visibleRows.length;
  return (
    <div className="mt-0.5 ml-12">
      <dl className="m-0 grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)] gap-x-3">
        {visibleRows.map((row) => (
          <div
            key={row.key}
            className="contents"
          >
            <dt
              className="truncate text-gray-500"
              title={row.fields.join(', ')}
            >
              {row.label}
            </dt>
            <dd className="m-0 break-words">
              {row.before && (
                <>
                  <span className="text-gray-400">
                    <Value value={row.before} />
                  </span>
                  {' → '}
                </>
              )}
              <Value value={row.after} />
            </dd>
          </div>
        ))}
      </dl>
      {rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          className="mt-0.5 text-blue-600 underline"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? 'Replier'
            : `+ ${hiddenRows} autre${hiddenRows > 1 ? 's' : ''} champ${hiddenRows > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
