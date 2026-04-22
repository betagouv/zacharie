import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { AdminCarcasseDetailResponse } from '@api/src/types/responses';
import type { Carcasse, CarcasseIntermediaire, Fei } from '@prisma/client';
import dayjs from 'dayjs';

type DepotEntityInfo = {
  nom_d_usage: string | null;
  numero_ddecpp: string | null;
  address_ligne_1: string | null;
  code_postal: string | null;
  ville: string | null;
};

type CarcasseDetail = Carcasse & {
  CarcasseIntermediaire: Array<
    CarcasseIntermediaire & {
      CarcasseIntermediaireEntity: {
        nom_d_usage: string;
        type: string;
        numero_ddecpp: string | null;
        address_ligne_1: string | null;
        code_postal: string | null;
        ville: string | null;
      };
      CarcasseIntermediaireUser: { email: string };
    }
  >;
  Fei: Fei;
};

interface TimelineEvent {
  date: Date | null;
  label: string;
  data: Record<string, unknown>;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YYYY HH:mm');
}

function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YYYY');
}

const statusColors: Record<string, string> = {
  ACCEPTEE: 'bg-green-100 text-green-800',
  REFUSEE: 'bg-red-100 text-red-800',
  CONSIGNE: 'bg-yellow-100 text-yellow-800',
  SAISIE: 'bg-red-200 text-red-900',
  LEVEE_DE_CONSIGNE: 'bg-blue-100 text-blue-800',
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const color = statusColors[status] ?? 'bg-gray-100 text-gray-800';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{children ?? '—'}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h4 className="mb-3 border-b pb-2 text-base font-bold">{title}</h4>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">{children}</dl>;
}

function formatEntityAddress(entity: {
  address_ligne_1: string | null;
  code_postal: string | null;
  ville: string | null;
}): string | null {
  const parts = [entity.address_ligne_1, [entity.code_postal, entity.ville].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return parts || null;
}

function formatNumeroIdentification(numero_ddecpp: string | null): string {
  return numero_ddecpp ?? "Absence de num\u00e9ro d'identification";
}

function buildTimeline(carcasse: CarcasseDetail, depotEntity: DepotEntityInfo | null): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    date: new Date(carcasse.created_at),
    label: 'Cr\u00e9ation carcasse',
    data: { 'ID Zacharie': carcasse.zacharie_carcasse_id, 'Esp\u00e8ce': carcasse.espece },
  });

  if (carcasse.date_mise_a_mort) {
    events.push({
      date: new Date(carcasse.date_mise_a_mort),
      label: 'Mise \u00e0 mort',
      data: { Heure: carcasse.heure_mise_a_mort },
    });
  }

  if (carcasse.heure_evisceration) {
    events.push({
      date: carcasse.date_mise_a_mort ? new Date(carcasse.date_mise_a_mort) : null,
      label: '\u00c9visc\u00e9ration',
      data: { Heure: carcasse.heure_evisceration },
    });
  }

  if (carcasse.examinateur_signed_at) {
    const data: Record<string, unknown> = {};
    if (carcasse.examinateur_carcasse_sans_anomalie != null) {
      data['Sans anomalie'] = carcasse.examinateur_carcasse_sans_anomalie ? 'Oui' : 'Non';
    }
    if (carcasse.examinateur_anomalies_carcasse.length > 0) {
      data['Anomalies carcasse'] = carcasse.examinateur_anomalies_carcasse.join(', ');
    }
    if (carcasse.examinateur_anomalies_abats.length > 0) {
      data['Anomalies abats'] = carcasse.examinateur_anomalies_abats.join(', ');
    }
    if (carcasse.examinateur_commentaire) {
      data['Commentaire'] = carcasse.examinateur_commentaire;
    }
    events.push({
      date: new Date(carcasse.examinateur_signed_at),
      label: 'Examen initial sign\u00e9',
      data,
    });
  }

  if (carcasse.premier_detenteur_depot_ccg_at) {
    const data: Record<string, unknown> = {
      'Type de d\u00e9p\u00f4t': carcasse.premier_detenteur_depot_type,
      'Entit\u00e9': carcasse.premier_detenteur_depot_entity_name_cache,
    };
    if (depotEntity) {
      data['N\u00b0 identification'] = formatNumeroIdentification(depotEntity.numero_ddecpp);
      const adresse = formatEntityAddress(depotEntity);
      if (adresse) data['Adresse'] = adresse;
    }
    events.push({
      date: new Date(carcasse.premier_detenteur_depot_ccg_at),
      label: `D\u00e9p\u00f4t CCG \u2014 ${carcasse.premier_detenteur_depot_entity_name_cache ?? 'Entit\u00e9 inconnue'}`,
      data,
    });
  }

  if (carcasse.premier_detenteur_transport_date) {
    const transportLabels: Record<string, string> = {
      PREMIER_DETENTEUR: 'Transport par le chasseur',
      COLLECTEUR_PRO: 'Transport par collecteur professionnel',
      ETG: 'Transport par ETG',
      AUCUN: 'Transport',
    };
    events.push({
      date: new Date(carcasse.premier_detenteur_transport_date),
      label:
        transportLabels[carcasse.premier_detenteur_transport_type ?? ''] ??
        'Transport premier d\u00e9tenteur',
      data: {
        'Type de transport': carcasse.premier_detenteur_transport_type,
        'Type de d\u00e9p\u00f4t': carcasse.premier_detenteur_depot_type,
      },
    });
  }

  for (const ci of carcasse.CarcasseIntermediaire) {
    const entity = ci.CarcasseIntermediaireEntity;
    const roleLabels: Record<string, string> = {
      COLLECTEUR_PRO: 'Collecteur professionnel',
      ETG: 'ETG',
      CCG: 'CCG',
    };
    const roleLabel =
      roleLabels[ci.intermediaire_role ?? ''] ?? ci.intermediaire_role ?? 'Interm\u00e9diaire';

    const entityData: Record<string, unknown> = {
      'R\u00f4le': roleLabel,
      'Entit\u00e9': entity.nom_d_usage,
      'N\u00b0 identification': formatNumeroIdentification(entity.numero_ddecpp),
    };
    const adresse = formatEntityAddress(entity);
    if (adresse) entityData['Adresse'] = adresse;
    entityData['Utilisateur'] = ci.CarcasseIntermediaireUser.email;

    events.push({
      date: new Date(ci.created_at),
      label: `Interm\u00e9diaire cr\u00e9\u00e9 \u2014 ${entity.nom_d_usage}`,
      data: entityData,
    });

    if (ci.prise_en_charge_at) {
      const priseData: Record<string, unknown> = {
        'Prise en charge': ci.prise_en_charge ? 'Oui' : 'Non',
      };
      if (ci.intermediaire_poids != null) priseData['Poids'] = `${ci.intermediaire_poids} kg`;
      events.push({
        date: new Date(ci.prise_en_charge_at),
        label: `Prise en charge ${roleLabel} \u2014 ${entity.nom_d_usage}`,
        data: priseData,
      });
    }

    if (ci.decision_at) {
      const decisionData: Record<string, unknown> = {};
      if (ci.refus) decisionData['Refus'] = ci.refus;
      if (ci.manquante != null) decisionData['Manquante'] = ci.manquante ? 'Oui' : 'Non';
      if (ci.commentaire) decisionData['Commentaire'] = ci.commentaire;
      if (ci.intermediaire_depot_type) decisionData['Type de d\u00e9p\u00f4t'] = ci.intermediaire_depot_type;
      events.push({
        date: new Date(ci.decision_at),
        label: `D\u00e9cision ${roleLabel} \u2014 ${entity.nom_d_usage}`,
        data: decisionData,
      });
    }
  }

  if (carcasse.svi_assigned_to_fei_at) {
    events.push({ date: new Date(carcasse.svi_assigned_to_fei_at), label: 'Assignation SVI', data: {} });
  }

  if (carcasse.svi_ipm1_signed_at) {
    const data: Record<string, unknown> = {};
    if (carcasse.svi_ipm1_decision) data['D\u00e9cision'] = carcasse.svi_ipm1_decision;
    if (carcasse.svi_ipm1_protocole) data['Protocole'] = carcasse.svi_ipm1_protocole;
    if (carcasse.svi_ipm1_commentaire) data['Commentaire'] = carcasse.svi_ipm1_commentaire;
    events.push({
      date: new Date(carcasse.svi_ipm1_signed_at),
      label: 'IPM1 sign\u00e9',
      data,
    });
  }

  if (carcasse.svi_ipm2_signed_at) {
    const data: Record<string, unknown> = {};
    if (carcasse.svi_ipm2_decision) data['D\u00e9cision'] = carcasse.svi_ipm2_decision;
    if (carcasse.svi_ipm2_commentaire) data['Commentaire'] = carcasse.svi_ipm2_commentaire;
    events.push({
      date: new Date(carcasse.svi_ipm2_signed_at),
      label: 'IPM2 sign\u00e9',
      data,
    });
  }

  if (carcasse.svi_carcasse_status_set_at) {
    events.push({
      date: new Date(carcasse.svi_carcasse_status_set_at),
      label: 'Statut final SVI',
      data: { Statut: carcasse.svi_carcasse_status },
    });
  }

  events.sort((a, b) => {
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date.getTime() - b.date.getTime();
  });

  return events;
}

function TimelineEventData({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return null;
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded bg-gray-50 p-2 text-xs">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="contents"
        >
          <dt className="text-gray-500">{key}</dt>
          <dd className="text-gray-700">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminCarcasseDetail() {
  const params = useParams<{ zacharie_carcasse_id: string }>();
  const [carcasse, setCarcasse] = useState<CarcasseDetail | null>(null);
  const [depotEntity, setDepotEntity] = useState<DepotEntityInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.zacharie_carcasse_id) return;
    setLoading(true);
    API.get({ path: `admin/carcasse/${encodeURIComponent(params.zacharie_carcasse_id)}` })
      .then((res) => res as AdminCarcasseDetailResponse)
      .then((res) => {
        if (res.ok) {
          setCarcasse(res.data.carcasse as CarcasseDetail);
          setDepotEntity(res.data.depotEntity);
        }
      })
      .finally(() => setLoading(false));
  }, [params.zacharie_carcasse_id]);

  if (loading) return <Chargement />;
  if (!carcasse) return <p className="py-8 text-center text-gray-500">Carcasse introuvable</p>;

  const timeline = buildTimeline(carcasse, depotEntity);

  return (
    <>
      <Link
        to="/app/admin/carcasses"
        className="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
      >
        <span
          className="fr-icon-arrow-left-line fr-icon--sm mr-1"
          aria-hidden="true"
        />
        Retour à la liste
      </Link>
      <div className="grid grid-cols-1 gap-4 space-y-6 py-4 md:grid-cols-2">
        {/* Back button */}

        {/* 1. En-tête / Identité */}
        <Section title="Identité">
          <FieldGrid>
            <Field label="Numéro bracelet">{carcasse.numero_bracelet}</Field>
            <Field label="Espèce">{carcasse.espece ?? '—'}</Field>
            <Field label="Type">{carcasse.type ?? '—'}</Field>
            <Field label="Nombre d'animaux">{carcasse.nombre_d_animaux ?? '—'}</Field>
            <Field label="FEI numéro">
              <Link
                to={`/app/tableau-de-bord/fei/${encodeURIComponent(carcasse.fei_numero)}`}
                className="text-blue-600 underline"
              >
                {carcasse.fei_numero}
              </Link>
            </Field>
            <Field label="Statut SVI">
              <StatusBadge status={carcasse.svi_carcasse_status} />
            </Field>
            <Field label="Créée le">{formatDate(carcasse.created_at)}</Field>
            <Field label="Mise à jour le">{formatDate(carcasse.updated_at)}</Field>
          </FieldGrid>
        </Section>

        {/* 2. Mise à mort & Éviscération */}
        {(carcasse.date_mise_a_mort || carcasse.heure_evisceration) && (
          <Section title="Mise à mort & Éviscération">
            <FieldGrid>
              <Field label="Date de mise à mort">{formatDateOnly(carcasse.date_mise_a_mort)}</Field>
              <Field label="Heure de mise à mort">{carcasse.heure_mise_a_mort ?? '—'}</Field>
              <Field label="Heure d'éviscération">{carcasse.heure_evisceration ?? '—'}</Field>
              {carcasse.consommateur_final_usage_domestique && (
                <Field label="Consommateur final usage domestique">
                  {formatDate(carcasse.consommateur_final_usage_domestique)}
                </Field>
              )}
            </FieldGrid>
          </Section>
        )}

        {/* 3. Examen initial */}
        {carcasse.examinateur_signed_at && (
          <Section title="Examen initial (Examinateur)">
            <FieldGrid>
              <Field label="Sans anomalie">
                {carcasse.examinateur_carcasse_sans_anomalie == null
                  ? '—'
                  : carcasse.examinateur_carcasse_sans_anomalie
                    ? 'Oui'
                    : 'Non'}
              </Field>
              {carcasse.examinateur_anomalies_carcasse.length > 0 && (
                <Field label="Anomalies carcasse">{carcasse.examinateur_anomalies_carcasse.join(', ')}</Field>
              )}
              {carcasse.examinateur_anomalies_abats.length > 0 && (
                <Field label="Anomalies abats">{carcasse.examinateur_anomalies_abats.join(', ')}</Field>
              )}
              <Field label="Commentaire">{carcasse.examinateur_commentaire ?? '—'}</Field>
              <Field label="Signé le">{formatDate(carcasse.examinateur_signed_at)}</Field>
              <Field label="Examinateur (user ID)">{carcasse.examinateur_initial_user_id ?? '—'}</Field>
              <Field label="Approbation mise sur le marché">
                {carcasse.examinateur_initial_approbation_mise_sur_le_marche == null
                  ? '—'
                  : carcasse.examinateur_initial_approbation_mise_sur_le_marche
                    ? 'Oui'
                    : 'Non'}
              </Field>
              {carcasse.examinateur_initial_date_approbation_mise_sur_le_marche && (
                <Field label="Date approbation">
                  {formatDate(carcasse.examinateur_initial_date_approbation_mise_sur_le_marche)}
                </Field>
              )}
            </FieldGrid>
          </Section>
        )}

        {/* 4. Premier détenteur */}
        {carcasse.premier_detenteur_user_id && (
          <Section title="Premier détenteur">
            <FieldGrid>
              <Field label="Nom (cache)">{carcasse.premier_detenteur_name_cache ?? '—'}</Field>
              <Field label="User ID">{carcasse.premier_detenteur_user_id}</Field>
              <Field label="Entité ID">{carcasse.premier_detenteur_entity_id ?? '—'}</Field>
              <Field label="Type de dépôt">{carcasse.premier_detenteur_depot_type ?? '—'}</Field>
              <Field label="Entité dépôt">{carcasse.premier_detenteur_depot_entity_name_cache ?? '—'}</Field>
              {carcasse.premier_detenteur_depot_ccg_at && (
                <Field label="Date dépôt CCG">{formatDate(carcasse.premier_detenteur_depot_ccg_at)}</Field>
              )}
              <Field label="Transport type">{carcasse.premier_detenteur_transport_type ?? '—'}</Field>
              {carcasse.premier_detenteur_transport_date && (
                <Field label="Transport date">{formatDate(carcasse.premier_detenteur_transport_date)}</Field>
              )}
              <Field label="Prochain détenteur rôle">
                {carcasse.premier_detenteur_prochain_detenteur_role_cache ?? '—'}
              </Field>
              <Field label="Prochain détenteur ID">
                {carcasse.premier_detenteur_prochain_detenteur_id_cache ?? '—'}
              </Field>
            </FieldGrid>
          </Section>
        )}

        {/* 5. Chaîne intermédiaires */}
        {carcasse.CarcasseIntermediaire.length > 0 && (
          <Section title={`Intermédiaires (${carcasse.CarcasseIntermediaire.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-2">Entité</th>
                    <th className="p-2">Type entité</th>
                    <th className="p-2">Utilisateur</th>
                    <th className="p-2">Rôle</th>
                    <th className="p-2">Prise en charge</th>
                    <th className="p-2">Décision</th>
                    <th className="p-2">Poids</th>
                    <th className="p-2">Refus</th>
                    <th className="p-2">Manquante</th>
                    <th className="p-2">Commentaire</th>
                    <th className="p-2">Dépôt type</th>
                    <th className="p-2">Prochain détenteur</th>
                  </tr>
                </thead>
                <tbody>
                  {carcasse.CarcasseIntermediaire.map((ci) => (
                    <tr
                      key={`${ci.fei_numero}_${ci.zacharie_carcasse_id}_${ci.intermediaire_id}`}
                      className="border-b"
                    >
                      <td className="p-2">{ci.CarcasseIntermediaireEntity.nom_d_usage}</td>
                      <td className="p-2">{ci.CarcasseIntermediaireEntity.type}</td>
                      <td className="p-2">{ci.CarcasseIntermediaireUser.email}</td>
                      <td className="p-2">{ci.intermediaire_role ?? '—'}</td>
                      <td className="p-2">
                        {ci.prise_en_charge == null ? '—' : ci.prise_en_charge ? 'Oui' : 'Non'}
                        {ci.prise_en_charge_at && (
                          <span className="block text-gray-400">{formatDate(ci.prise_en_charge_at)}</span>
                        )}
                      </td>
                      <td className="p-2">{formatDate(ci.decision_at)}</td>
                      <td className="p-2">{ci.intermediaire_poids ?? '—'}</td>
                      <td
                        className="max-w-[120px] truncate p-2"
                        title={ci.refus ?? ''}
                      >
                        {ci.refus ?? '—'}
                      </td>
                      <td className="p-2">{ci.manquante == null ? '—' : ci.manquante ? 'Oui' : 'Non'}</td>
                      <td
                        className="max-w-[120px] truncate p-2"
                        title={ci.commentaire ?? ''}
                      >
                        {ci.commentaire ?? '—'}
                      </td>
                      <td className="p-2">{ci.intermediaire_depot_type ?? '—'}</td>
                      <td className="p-2">
                        {ci.intermediaire_prochain_detenteur_role_cache ?? '—'}
                        {ci.intermediaire_prochain_detenteur_id_cache && (
                          <span className="block text-gray-400">
                            {ci.intermediaire_prochain_detenteur_id_cache}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* 6. Inspection SVI — IPM1 */}
        {carcasse.svi_ipm1_signed_at && (
          <Section title="Inspection SVI — IPM1">
            <FieldGrid>
              <Field label="Date">{formatDate(carcasse.svi_ipm1_date)}</Field>
              <Field label="Protocole">{carcasse.svi_ipm1_protocole ?? '—'}</Field>
              <Field label="Présentée à l'inspection">
                {carcasse.svi_ipm1_presentee_inspection == null
                  ? '—'
                  : carcasse.svi_ipm1_presentee_inspection
                    ? 'Oui'
                    : 'Non'}
              </Field>
              {carcasse.svi_ipm1_pieces.length > 0 && (
                <Field label="Pièces examinées">{carcasse.svi_ipm1_pieces.join(', ')}</Field>
              )}
              {carcasse.svi_ipm1_lesions_ou_motifs.length > 0 && (
                <Field label="Lésions / motifs">{carcasse.svi_ipm1_lesions_ou_motifs.join(', ')}</Field>
              )}
              <Field label="Nombre d'animaux">{carcasse.svi_ipm1_nombre_animaux ?? '—'}</Field>
              <Field label="Décision">{carcasse.svi_ipm1_decision ?? '—'}</Field>
              <Field label="Commentaire">{carcasse.svi_ipm1_commentaire ?? '—'}</Field>
              {carcasse.svi_ipm1_poids_consigne != null && (
                <Field label="Poids consigne">{carcasse.svi_ipm1_poids_consigne} kg</Field>
              )}
              {carcasse.svi_ipm1_poids_type && (
                <Field label="Type poids">{carcasse.svi_ipm1_poids_type}</Field>
              )}
              {carcasse.svi_ipm1_duree_consigne != null && (
                <Field label="Durée consigne">{carcasse.svi_ipm1_duree_consigne}h</Field>
              )}
              <Field label="Inspecteur">
                {carcasse.svi_ipm1_user_name_cache ?? carcasse.svi_ipm1_user_id ?? '—'}
              </Field>
              <Field label="Signé le">{formatDate(carcasse.svi_ipm1_signed_at)}</Field>
            </FieldGrid>
          </Section>
        )}

        {/* 6b. Inspection SVI — IPM2 */}
        {carcasse.svi_ipm2_signed_at && (
          <Section title="Inspection SVI — IPM2">
            <FieldGrid>
              <Field label="Date">{formatDate(carcasse.svi_ipm2_date)}</Field>
              <Field label="Protocole">{carcasse.svi_ipm2_protocole ?? '—'}</Field>
              <Field label="Présentée à l'inspection">
                {carcasse.svi_ipm2_presentee_inspection == null
                  ? '—'
                  : carcasse.svi_ipm2_presentee_inspection
                    ? 'Oui'
                    : 'Non'}
              </Field>
              {carcasse.svi_ipm2_pieces.length > 0 && (
                <Field label="Pièces examinées">{carcasse.svi_ipm2_pieces.join(', ')}</Field>
              )}
              {carcasse.svi_ipm2_lesions_ou_motifs.length > 0 && (
                <Field label="Lésions / motifs">{carcasse.svi_ipm2_lesions_ou_motifs.join(', ')}</Field>
              )}
              <Field label="Nombre d'animaux">{carcasse.svi_ipm2_nombre_animaux ?? '—'}</Field>
              <Field label="Décision">{carcasse.svi_ipm2_decision ?? '—'}</Field>
              <Field label="Commentaire">{carcasse.svi_ipm2_commentaire ?? '—'}</Field>
              {carcasse.svi_ipm2_traitement_assainissant.length > 0 && (
                <Field label="Traitement assainissant">
                  {carcasse.svi_ipm2_traitement_assainissant.join(', ')}
                </Field>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_cuisson_temps && (
                <Field label="Cuisson temps">{carcasse.svi_ipm2_traitement_assainissant_cuisson_temps}</Field>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_cuisson_temp && (
                <Field label="Cuisson temp.">{carcasse.svi_ipm2_traitement_assainissant_cuisson_temp}</Field>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_congelation_temps && (
                <Field label="Congélation temps">
                  {carcasse.svi_ipm2_traitement_assainissant_congelation_temps}
                </Field>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_congelation_temp && (
                <Field label="Congélation temp.">
                  {carcasse.svi_ipm2_traitement_assainissant_congelation_temp}
                </Field>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_etablissement && (
                <Field label="Établissement traitement">
                  {carcasse.svi_ipm2_traitement_assainissant_etablissement}
                </Field>
              )}
              {carcasse.svi_ipm2_poids_saisie != null && (
                <Field label="Poids saisie">{carcasse.svi_ipm2_poids_saisie} kg</Field>
              )}
              {carcasse.svi_ipm2_poids_type && (
                <Field label="Type poids">{carcasse.svi_ipm2_poids_type}</Field>
              )}
              <Field label="Inspecteur">
                {carcasse.svi_ipm2_user_name_cache ?? carcasse.svi_ipm2_user_id ?? '—'}
              </Field>
              <Field label="Signé le">{formatDate(carcasse.svi_ipm2_signed_at)}</Field>
            </FieldGrid>
          </Section>
        )}

        {/* SVI commentaire global */}
        {carcasse.svi_carcasse_commentaire && (
          <Section title="Commentaire SVI global">
            <p className="text-sm">{carcasse.svi_carcasse_commentaire}</p>
          </Section>
        )}

        {/* 7. Propriété actuelle */}
        {(carcasse.current_owner_user_id || carcasse.next_owner_user_id || carcasse.prev_owner_user_id) && (
          <Section title="Propriété actuelle">
            <FieldGrid>
              <Field label="Owner actuel (user)">
                {carcasse.current_owner_user_name_cache ?? carcasse.current_owner_user_id ?? '—'}
              </Field>
              <Field label="Owner actuel (entité)">
                {carcasse.current_owner_entity_name_cache ?? carcasse.current_owner_entity_id ?? '—'}
              </Field>
              <Field label="Owner actuel (rôle)">{carcasse.current_owner_role ?? '—'}</Field>
              <Field label="Next owner (user)">
                {carcasse.next_owner_user_name_cache ?? carcasse.next_owner_user_id ?? '—'}
              </Field>
              <Field label="Next owner (entité)">
                {carcasse.next_owner_entity_name_cache ?? carcasse.next_owner_entity_id ?? '—'}
              </Field>
              <Field label="Next owner (rôle)">{carcasse.next_owner_role ?? '—'}</Field>
              {carcasse.next_owner_wants_to_sous_traite && (
                <Field label="Sous-traitance">Oui — {formatDate(carcasse.next_owner_sous_traite_at)}</Field>
              )}
              <Field label="Previous owner (user)">{carcasse.prev_owner_user_id ?? '—'}</Field>
              <Field label="Previous owner (entité)">{carcasse.prev_owner_entity_id ?? '—'}</Field>
              <Field label="Previous owner (rôle)">{carcasse.prev_owner_role ?? '—'}</Field>
            </FieldGrid>
          </Section>
        )}

        {/* 8. Fil de vie (timeline) */}
        <Section title="Fil de vie">
          <div className="relative border-l-2 border-gray-300 pl-4">
            {timeline.map((event, i) => (
              <div
                key={i}
                className="relative mb-4"
              >
                <div className="absolute top-1 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" />
                <div className="text-xs text-gray-500">{event.date ? formatDate(event.date) : '—'}</div>
                <div className="text-sm font-semibold">{event.label}</div>
                <TimelineEventData data={event.data} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
