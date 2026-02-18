import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import type { AdminCarcasseResponse, AdminUsersResponse, AdminEntitiesResponse } from '@api/src/types/responses';
import type { Carcasse, User, Entity } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';
import { toast } from 'react-toastify';

// --- Field type metadata ---

const booleanFields = new Set<keyof Carcasse>([
  'examinateur_carcasse_sans_anomalie',
  'intermediaire_carcasse_manquante',
  'svi_ipm1_presentee_inspection',
  'svi_ipm2_presentee_inspection',
  'examinateur_initial_offline',
  'examinateur_initial_approbation_mise_sur_le_marche',
  'premier_detenteur_offline',
  'next_owner_wants_to_sous_traite',
  'is_synced',
]);

const dateTimeFields = new Set<keyof Carcasse>([
  'date_mise_a_mort',
  'examinateur_signed_at',
  'premier_detenteur_depot_ccg_at',
  'premier_detenteur_transport_date',
  'latest_intermediaire_signed_at',
  'svi_assigned_to_fei_at',
  'svi_carcasse_status_set_at',
  'svi_ipm1_date',
  'svi_ipm1_signed_at',
  'svi_ipm2_date',
  'svi_ipm2_signed_at',
  'examinateur_initial_date_approbation_mise_sur_le_marche',
  'intermediaire_closed_at',
  'svi_assigned_at',
  'svi_closed_at',
  'next_owner_sous_traite_at',
  'created_at',
  'updated_at',
  'deleted_at',
]);

const intFields = new Set<keyof Carcasse>([
  'nombre_d_animaux',
  'svi_ipm1_nombre_animaux',
  'svi_ipm1_duree_consigne',
  'svi_ipm2_nombre_animaux',
]);

const floatFields = new Set<keyof Carcasse>([
  'svi_ipm1_poids_consigne',
  'svi_ipm2_traitement_assainissant_poids',
  'svi_ipm2_poids_saisie',
]);

const arrayFields = new Set<keyof Carcasse>([
  'examinateur_anomalies_carcasse',
  'examinateur_anomalies_abats',
  'svi_ipm1_pieces',
  'svi_ipm1_lesions_ou_motifs',
  'svi_ipm2_pieces',
  'svi_ipm2_lesions_ou_motifs',
  'svi_ipm2_traitement_assainissant',
]);

const enumFields: Record<string, string[]> = {
  type: ['PETIT_GIBIER', 'GROS_GIBIER'],
  premier_detenteur_depot_type: ['CCG', 'ETG', 'AUCUN'],
  premier_detenteur_transport_type: ['PREMIER_DETENTEUR', 'ETG', 'COLLECTEUR_PRO', 'AUCUN'],
  svi_carcasse_status: [
    'MANQUANTE_ETG_COLLECTEUR',
    'REFUS_ETG_COLLECTEUR',
    'SANS_DECISION',
    'ACCEPTE',
    'CONSIGNE',
    'MANQUANTE_SVI',
    'SAISIE_TOTALE',
    'SAISIE_PARTIELLE',
    'LEVEE_DE_CONSIGNE',
    'TRAITEMENT_ASSAINISSANT',
  ],
  svi_ipm1_protocole: ['STANDARD', 'RENFORCE'],
  svi_ipm1_decision: ['NON_RENSEIGNEE', 'MISE_EN_CONSIGNE', 'ACCEPTE'],
  svi_ipm1_poids_type: ['NON_DEPOUILLE', 'DEPOUILLE', 'NON_PLUMEE', 'PLUMEE'],
  svi_ipm2_protocole: ['STANDARD', 'RENFORCE'],
  svi_ipm2_decision: ['NON_RENSEIGNEE', 'LEVEE_DE_LA_CONSIGNE', 'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT'],
  svi_ipm2_poids_type: ['NON_DEPOUILLE', 'DEPOUILLE', 'NON_PLUMEE', 'PLUMEE'],
  current_owner_role: [
    'EXAMINATEUR_INITIAL',
    'PREMIER_DETENTEUR',
    'ETG',
    'COLLECTEUR_PRO',
    'SVI',
    'COMMERCE_DE_DETAIL',
    'CANTINE_OU_RESTAURATION_COLLECTIVE',
    'ASSOCIATION_CARITATIVE',
    'REPAS_DE_CHASSE_OU_ASSOCIATIF',
    'CONSOMMATEUR_FINAL',
  ],
  next_owner_role: [
    'EXAMINATEUR_INITIAL',
    'PREMIER_DETENTEUR',
    'ETG',
    'COLLECTEUR_PRO',
    'SVI',
    'COMMERCE_DE_DETAIL',
    'CANTINE_OU_RESTAURATION_COLLECTIVE',
    'ASSOCIATION_CARITATIVE',
    'REPAS_DE_CHASSE_OU_ASSOCIATIF',
    'CONSOMMATEUR_FINAL',
  ],
  prev_owner_role: [
    'EXAMINATEUR_INITIAL',
    'PREMIER_DETENTEUR',
    'ETG',
    'COLLECTEUR_PRO',
    'SVI',
    'COMMERCE_DE_DETAIL',
    'CANTINE_OU_RESTAURATION_COLLECTIVE',
    'ASSOCIATION_CARITATIVE',
    'REPAS_DE_CHASSE_OU_ASSOCIATIF',
    'CONSOMMATEUR_FINAL',
  ],
  premier_detenteur_prochain_detenteur_role_cache: [
    'EXAMINATEUR_INITIAL',
    'PREMIER_DETENTEUR',
    'ETG',
    'COLLECTEUR_PRO',
    'SVI',
    'COMMERCE_DE_DETAIL',
    'CANTINE_OU_RESTAURATION_COLLECTIVE',
    'ASSOCIATION_CARITATIVE',
    'REPAS_DE_CHASSE_OU_ASSOCIATIF',
    'CONSOMMATEUR_FINAL',
  ],
};

const userRelationFields = new Set<string>([
  'created_by_user_id',
  'examinateur_initial_user_id',
  'premier_detenteur_user_id',
  'svi_ipm1_user_id',
  'svi_ipm2_user_id',
  'intermediaire_closed_by_user_id',
  'latest_intermediaire_user_id',
  'svi_user_id',
  'svi_closed_by_user_id',
  'current_owner_user_id',
  'next_owner_sous_traite_by_user_id',
  'next_owner_user_id',
  'prev_owner_user_id',
]);

const entityRelationFields = new Set<string>([
  'premier_detenteur_depot_entity_id',
  'premier_detenteur_entity_id',
  'intermediaire_carcasse_refus_intermediaire_id',
  'intermediaire_closed_by_entity_id',
  'latest_intermediaire_entity_id',
  'svi_entity_id',
  'current_owner_entity_id',
  'next_owner_sous_traite_by_entity_id',
  'next_owner_entity_id',
  'prev_owner_entity_id',
  'premier_detenteur_prochain_detenteur_id_cache',
]);

const readOnlyFields = new Set<string>(['zacharie_carcasse_id', 'created_at', 'updated_at']);

// Fields grouped by section
const sections: Array<{ title: string; fields: Array<keyof Carcasse> }> = [
  {
    title: 'Identification',
    fields: [
      'zacharie_carcasse_id',
      'numero_bracelet',
      'fei_numero',
      'espece',
      'type',
      'nombre_d_animaux',
      'date_mise_a_mort',
      'heure_mise_a_mort',
      'heure_evisceration',
      'heure_mise_a_mort_premiere_carcasse_fei',
      'heure_evisceration_derniere_carcasse_fei',
    ],
  },
  {
    title: 'Examinateur',
    fields: [
      'examinateur_carcasse_sans_anomalie',
      'examinateur_anomalies_carcasse',
      'examinateur_anomalies_abats',
      'examinateur_commentaire',
      'examinateur_signed_at',
    ],
  },
  {
    title: 'Premier Détenteur',
    fields: [
      'premier_detenteur_depot_type',
      'premier_detenteur_depot_entity_id',
      'premier_detenteur_depot_entity_name_cache',
      'premier_detenteur_depot_ccg_at',
      'premier_detenteur_transport_type',
      'premier_detenteur_transport_date',
      'premier_detenteur_prochain_detenteur_role_cache',
      'premier_detenteur_prochain_detenteur_id_cache',
    ],
  },
  {
    title: 'Intermédiaire',
    fields: [
      'intermediaire_carcasse_refus_intermediaire_id',
      'intermediaire_carcasse_refus_motif',
      'intermediaire_carcasse_manquante',
      'latest_intermediaire_signed_at',
    ],
  },
  {
    title: 'SVI - Statut',
    fields: ['svi_assigned_to_fei_at', 'svi_carcasse_commentaire', 'svi_carcasse_status', 'svi_carcasse_status_set_at'],
  },
  {
    title: 'SVI IPM1',
    fields: [
      'svi_ipm1_date',
      'svi_ipm1_presentee_inspection',
      'svi_ipm1_user_id',
      'svi_ipm1_user_name_cache',
      'svi_ipm1_protocole',
      'svi_ipm1_pieces',
      'svi_ipm1_lesions_ou_motifs',
      'svi_ipm1_nombre_animaux',
      'svi_ipm1_commentaire',
      'svi_ipm1_decision',
      'svi_ipm1_duree_consigne',
      'svi_ipm1_poids_consigne',
      'svi_ipm1_poids_type',
      'svi_ipm1_signed_at',
    ],
  },
  {
    title: 'SVI IPM2',
    fields: [
      'svi_ipm2_date',
      'svi_ipm2_presentee_inspection',
      'svi_ipm2_user_id',
      'svi_ipm2_user_name_cache',
      'svi_ipm2_protocole',
      'svi_ipm2_pieces',
      'svi_ipm2_lesions_ou_motifs',
      'svi_ipm2_nombre_animaux',
      'svi_ipm2_commentaire',
      'svi_ipm2_decision',
      'svi_ipm2_traitement_assainissant',
      'svi_ipm2_traitement_assainissant_cuisson_temps',
      'svi_ipm2_traitement_assainissant_cuisson_temp',
      'svi_ipm2_traitement_assainissant_congelation_temps',
      'svi_ipm2_traitement_assainissant_congelation_temp',
      'svi_ipm2_traitement_assainissant_type',
      'svi_ipm2_traitement_assainissant_paramètres',
      'svi_ipm2_traitement_assainissant_etablissement',
      'svi_ipm2_traitement_assainissant_poids',
      'svi_ipm2_poids_saisie',
      'svi_ipm2_poids_type',
      'svi_ipm2_signed_at',
    ],
  },
  {
    title: 'Ownership',
    fields: [
      'created_by_user_id',
      'examinateur_initial_offline',
      'examinateur_initial_user_id',
      'examinateur_initial_approbation_mise_sur_le_marche',
      'examinateur_initial_date_approbation_mise_sur_le_marche',
      'premier_detenteur_offline',
      'premier_detenteur_user_id',
      'premier_detenteur_entity_id',
      'premier_detenteur_name_cache',
      'intermediaire_closed_at',
      'intermediaire_closed_by_user_id',
      'intermediaire_closed_by_entity_id',
      'latest_intermediaire_user_id',
      'latest_intermediaire_entity_id',
      'latest_intermediaire_name_cache',
      'svi_assigned_at',
      'svi_entity_id',
      'svi_user_id',
      'svi_closed_at',
      'svi_closed_by_user_id',
      'current_owner_user_id',
      'current_owner_user_name_cache',
      'current_owner_entity_id',
      'current_owner_entity_name_cache',
      'current_owner_role',
      'next_owner_wants_to_sous_traite',
      'next_owner_sous_traite_at',
      'next_owner_sous_traite_by_user_id',
      'next_owner_sous_traite_by_entity_id',
      'next_owner_user_id',
      'next_owner_user_name_cache',
      'next_owner_entity_id',
      'next_owner_entity_name_cache',
      'next_owner_role',
      'prev_owner_user_id',
      'prev_owner_entity_id',
      'prev_owner_role',
    ],
  },
  {
    title: 'Technique',
    fields: ['created_at', 'updated_at', 'deleted_at', 'is_synced'],
  },
];

// --- Helpers ---

function toDateInputValue(val: string): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function toDateTimeInputValue(val: string): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

// --- Relation search component ---

function RelationSearchField({
  field,
  value,
  onChange,
  items,
  labelFn,
}: {
  field: string;
  value: string;
  onChange: (val: string) => void;
  items: Array<{ id: string; label: string }>;
  labelFn?: (id: string) => string;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = useMemo(() => {
    if (!value) return '';
    if (labelFn) return labelFn(value);
    const item = items.find((i) => i.id === value);
    return item?.label || value;
  }, [value, items, labelFn]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items.slice(0, 20);
    const q = search.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)).slice(0, 20);
  }, [items, search]);

  return (
    <div className="relative">
      <label className="fr-label mb-1">{field}</label>
      {value && (
        <div className="fr-mb-1w flex items-center gap-2">
          <span className="text-sm">
            {currentLabel} <span className="text-gray-400">({value})</span>
          </span>
          <button
            type="button"
            className="text-action-high-blue-france text-sm underline"
            onClick={() => {
              onChange('');
              setSearch('');
            }}
          >
            Retirer
          </button>
        </div>
      )}
      <input
        type="search"
        className="fr-input"
        placeholder="Rechercher par nom, email ou ID..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay to allow click on result
          setTimeout(() => setIsOpen(false), 200);
        }}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-gray-300 bg-white shadow-lg">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item.id);
                  setSearch('');
                  setIsOpen(false);
                }}
              >
                {item.label} <span className="text-gray-400">({item.id})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Main component ---

export default function AdminCarcasse() {
  const { carcasseId } = useParams<{ carcasseId: string }>();
  const [carcasse, setCarcasse] = useState<Carcasse | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Array<User>>([]);
  const [entities, setEntities] = useState<Array<Entity>>([]);

  // Load users and entities for relation search
  useEffect(() => {
    Promise.all([
      API.get({ path: 'admin/users' }).then((res) => res as AdminUsersResponse),
      API.get({ path: 'admin/entities' }).then((res) => res as AdminEntitiesResponse),
    ]).then(([usersRes, entitiesRes]) => {
      if (usersRes.ok) setUsers(usersRes.data.users);
      if (entitiesRes.ok) setEntities(entitiesRes.data.entities);
    });
  }, []);

  const userItems = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        label: `${u.prenom || ''} ${u.nom_de_famille || ''} (${u.email || ''})`.trim(),
      })),
    [users],
  );

  const entityItems = useMemo(
    () =>
      entities.map((e) => ({
        id: e.id,
        label: `${e.nom_d_usage || e.raison_sociale || ''} (${e.type})`.trim(),
      })),
    [entities],
  );

  // Load carcasse data
  useEffect(() => {
    if (!carcasseId) return;
    setLoading(true);
    API.get({ path: `admin/carcasse/${encodeURIComponent(carcasseId)}` })
      .then((res) => res as AdminCarcasseResponse)
      .then((res) => {
        if (res.ok && res.data) {
          setCarcasse(res.data.carcasse);
          const initial: Record<string, unknown> = {};
          for (const key of Object.keys(res.data.carcasse)) {
            if (key === 'Fei' || key === 'CarcasseIntermediaire') continue;
            initial[key] = (res.data.carcasse as Record<string, unknown>)[key];
          }
          setFormData(initial);
        }
      })
      .finally(() => setLoading(false));
  }, [carcasseId]);

  const setField = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carcasse || !carcasseId) return;
    setSaving(true);

    const body: Record<string, unknown> = {};
    for (const key of Object.keys(formData)) {
      if (readOnlyFields.has(key)) continue;
      const original = (carcasse as Record<string, unknown>)[key];
      const current = formData[key];

      // Compare serialized values for change detection
      if (JSON.stringify(current) !== JSON.stringify(original)) {
        body[key] = current === '' ? null : current;
      }
    }

    if (Object.keys(body).length === 0) {
      toast.info('Aucune modification détectée');
      setSaving(false);
      return;
    }

    const res = (await API.put({
      path: `admin/carcasse/${encodeURIComponent(carcasseId)}`,
      body,
    })) as AdminCarcasseResponse;

    if (res.ok && res.data) {
      setCarcasse(res.data.carcasse);
      const updated: Record<string, unknown> = {};
      for (const key of Object.keys(res.data.carcasse)) {
        if (key === 'Fei' || key === 'CarcasseIntermediaire') continue;
        updated[key] = (res.data.carcasse as Record<string, unknown>)[key];
      }
      setFormData(updated);
      toast.success('Carcasse mise à jour avec succès');
    } else {
      toast.error(res.error || 'Erreur lors de la mise à jour');
    }
    setSaving(false);
  };

  if (loading) return <Chargement />;
  if (!carcasse) {
    return (
      <div className="fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <p>Carcasse introuvable.</p>
            <Link to="/app/tableau-de-bord/admin/carcasses">Retour à la liste</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fr-container--fluid fr-my-md-14v">
      <title>
        Carcasse {carcasse.numero_bracelet} | Admin | Zacharie | Ministère de l&apos;Agriculture et de la Souveraineté
        Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <div className="fr-mb-2w flex items-center justify-between gap-4">
            <h1 className="fr-h2">
              Carcasse: {carcasse.numero_bracelet} — {carcasse.espece || 'Espèce non renseignée'}
            </h1>
            <Link
              to="/app/tableau-de-bord/admin/carcasses"
              className="fr-link fr-icon-arrow-left-line fr-link--icon-left"
            >
              Retour à la liste
            </Link>
          </div>

          <form onSubmit={handleSubmit}>
            {sections.map((section) => (
              <section key={section.title} className="fr-mb-4w bg-white p-4 md:p-8 md:shadow-sm">
                <h2 className="fr-h4 fr-mb-2w">{section.title}</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {section.fields.map((field) => {
                    const isReadOnly = readOnlyFields.has(field);
                    const rawValue = formData[field];

                    // --- Boolean fields ---
                    if (booleanFields.has(field)) {
                      const checked = rawValue === true || rawValue === 'true';
                      const isNull = rawValue === null || rawValue === undefined;
                      return (
                        <div key={field}>
                          <Checkbox
                            disabled={isReadOnly}
                            options={[
                              {
                                label: field,
                                hintText: isNull ? '(non renseigné — cocher pour mettre à true)' : undefined,
                                nativeInputProps: {
                                  checked,
                                  onChange: (e) => setField(field, e.target.checked),
                                },
                              },
                            ]}
                          />
                          {!isReadOnly && !isNull && (
                            <button
                              type="button"
                              className="text-action-high-blue-france text-xs underline"
                              onClick={() => setField(field, null)}
                            >
                              Remettre à null
                            </button>
                          )}
                        </div>
                      );
                    }

                    // --- Enum / Select fields ---
                    if (field in enumFields) {
                      const value = rawValue != null ? String(rawValue) : '';
                      return (
                        <Select
                          key={field}
                          label={field}
                          disabled={isReadOnly}
                          nativeSelectProps={{
                            value,
                            onChange: (e) => setField(field, e.target.value || null),
                          }}
                        >
                          <option value="">— non renseigné —</option>
                          {enumFields[field].map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </Select>
                      );
                    }

                    // --- User relation fields ---
                    if (userRelationFields.has(field)) {
                      const value = rawValue != null ? String(rawValue) : '';
                      return (
                        <RelationSearchField
                          key={field}
                          field={field}
                          value={value}
                          onChange={(val) => setField(field, val || null)}
                          items={userItems}
                        />
                      );
                    }

                    // --- Entity relation fields ---
                    if (entityRelationFields.has(field)) {
                      const value = rawValue != null ? String(rawValue) : '';
                      return (
                        <RelationSearchField
                          key={field}
                          field={field}
                          value={value}
                          onChange={(val) => setField(field, val || null)}
                          items={entityItems}
                        />
                      );
                    }

                    // --- DateTime fields ---
                    if (dateTimeFields.has(field)) {
                      const strVal = rawValue != null ? String(rawValue) : '';
                      const isDateOnly = field === 'date_mise_a_mort';
                      const inputValue = isDateOnly ? toDateInputValue(strVal) : toDateTimeInputValue(strVal);
                      return (
                        <div key={field}>
                          <Input
                            label={field}
                            disabled={isReadOnly}
                            nativeInputProps={{
                              type: isDateOnly ? 'date' : 'datetime-local',
                              value: inputValue,
                              onChange: (e) => {
                                const v = e.target.value;
                                setField(field, v ? new Date(v).toISOString() : null);
                              },
                            }}
                          />
                          {!isReadOnly && strVal && (
                            <button
                              type="button"
                              className="text-action-high-blue-france text-xs underline"
                              onClick={() => setField(field, null)}
                            >
                              Remettre à null
                            </button>
                          )}
                        </div>
                      );
                    }

                    // --- Int fields ---
                    if (intFields.has(field)) {
                      const value = rawValue != null ? String(rawValue) : '';
                      return (
                        <Input
                          key={field}
                          label={field}
                          disabled={isReadOnly}
                          nativeInputProps={{
                            type: 'number',
                            step: '1',
                            value,
                            onChange: (e) => {
                              const v = e.target.value;
                              setField(field, v === '' ? null : parseInt(v, 10));
                            },
                          }}
                        />
                      );
                    }

                    // --- Float fields ---
                    if (floatFields.has(field)) {
                      const value = rawValue != null ? String(rawValue) : '';
                      return (
                        <Input
                          key={field}
                          label={field}
                          disabled={isReadOnly}
                          nativeInputProps={{
                            type: 'number',
                            step: '0.01',
                            value,
                            onChange: (e) => {
                              const v = e.target.value;
                              setField(field, v === '' ? null : parseFloat(v));
                            },
                          }}
                        />
                      );
                    }

                    // --- Array (String[]) fields ---
                    if (arrayFields.has(field)) {
                      const arr = Array.isArray(rawValue) ? rawValue : [];
                      return (
                        <div key={field}>
                          <label className="fr-label mb-1">{field}</label>
                          <div className="flex flex-col gap-1">
                            {arr.map((item: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  className="fr-input flex-1"
                                  value={item}
                                  disabled={isReadOnly}
                                  onChange={(e) => {
                                    const updated = [...arr];
                                    updated[idx] = e.target.value;
                                    setField(field, updated);
                                  }}
                                />
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    className="text-red-600 text-sm"
                                    onClick={() => {
                                      const updated = arr.filter((_: string, i: number) => i !== idx);
                                      setField(field, updated);
                                    }}
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            ))}
                            {!isReadOnly && (
                              <button
                                type="button"
                                className="text-action-high-blue-france text-sm underline"
                                onClick={() => setField(field, [...arr, ''])}
                              >
                                + Ajouter une valeur
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // --- Default: string text input ---
                    const value = rawValue != null ? String(rawValue) : '';
                    return (
                      <Input
                        key={field}
                        label={field}
                        disabled={isReadOnly}
                        nativeInputProps={{
                          value,
                          onChange: (e) => setField(field, e.target.value || null),
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ))}

            <div className="fr-mb-4w flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Sauvegarder'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
