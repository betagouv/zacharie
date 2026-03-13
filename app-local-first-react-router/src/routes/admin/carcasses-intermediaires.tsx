import { useEffect, useState } from 'react';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { AdminCarcassesResponse, AdminCarcasseDetailResponse } from '@api/src/types/responses';
import type { Carcasse, CarcasseIntermediaire, Fei } from '@prisma/client';
import dayjs from 'dayjs';

type CarcasseRow = AdminCarcassesResponse['data']['carcasses'][number];

type CarcasseDetail = Carcasse & {
  CarcasseIntermediaire: Array<
    CarcasseIntermediaire & {
      CarcasseIntermediaireEntity: { nom_d_usage: string; type: string };
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

function buildTimeline(carcasse: CarcasseDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    date: new Date(carcasse.created_at),
    label: 'Création carcasse',
    data: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id, espece: carcasse.espece },
  });

  if (carcasse.date_mise_a_mort) {
    events.push({
      date: new Date(carcasse.date_mise_a_mort),
      label: 'Mise à mort',
      data: { heure: carcasse.heure_mise_a_mort },
    });
  }

  if (carcasse.heure_evisceration) {
    events.push({
      date: carcasse.date_mise_a_mort ? new Date(carcasse.date_mise_a_mort) : null,
      label: 'Éviscération',
      data: { heure: carcasse.heure_evisceration },
    });
  }

  if (carcasse.examinateur_signed_at) {
    events.push({
      date: new Date(carcasse.examinateur_signed_at),
      label: 'Examen initial signé',
      data: {
        sans_anomalie: carcasse.examinateur_carcasse_sans_anomalie,
        anomalies_carcasse: carcasse.examinateur_anomalies_carcasse,
        anomalies_abats: carcasse.examinateur_anomalies_abats,
        commentaire: carcasse.examinateur_commentaire,
      },
    });
  }

  if (carcasse.premier_detenteur_depot_ccg_at) {
    events.push({
      date: new Date(carcasse.premier_detenteur_depot_ccg_at),
      label: 'Dépôt premier détenteur (CCG)',
      data: {
        depot_type: carcasse.premier_detenteur_depot_type,
        entity_name: carcasse.premier_detenteur_depot_entity_name_cache,
      },
    });
  }

  if (carcasse.premier_detenteur_transport_date) {
    events.push({
      date: new Date(carcasse.premier_detenteur_transport_date),
      label: 'Transport premier détenteur',
      data: {
        transport_type: carcasse.premier_detenteur_transport_type,
        depot_type: carcasse.premier_detenteur_depot_type,
      },
    });
  }

  for (const ci of carcasse.CarcasseIntermediaire) {
    events.push({
      date: new Date(ci.created_at),
      label: `Intermédiaire créé — ${ci.CarcasseIntermediaireEntity.nom_d_usage}`,
      data: {
        role: ci.intermediaire_role,
        entity_type: ci.CarcasseIntermediaireEntity.type,
        user: ci.CarcasseIntermediaireUser.email,
      },
    });

    if (ci.prise_en_charge_at) {
      events.push({
        date: new Date(ci.prise_en_charge_at),
        label: `Prise en charge — ${ci.CarcasseIntermediaireEntity.nom_d_usage}`,
        data: {
          prise_en_charge: ci.prise_en_charge,
          poids: ci.intermediaire_poids,
        },
      });
    }

    if (ci.decision_at) {
      events.push({
        date: new Date(ci.decision_at),
        label: `Décision — ${ci.CarcasseIntermediaireEntity.nom_d_usage}`,
        data: {
          refus: ci.refus,
          manquante: ci.manquante,
          commentaire: ci.commentaire,
          depot_type: ci.intermediaire_depot_type,
        },
      });
    }
  }

  if (carcasse.svi_assigned_to_fei_at) {
    events.push({
      date: new Date(carcasse.svi_assigned_to_fei_at),
      label: 'Assignation SVI',
      data: {},
    });
  }

  if (carcasse.svi_ipm1_signed_at) {
    events.push({
      date: new Date(carcasse.svi_ipm1_signed_at),
      label: 'IPM1 signé',
      data: {
        decision: carcasse.svi_ipm1_decision,
        protocole: carcasse.svi_ipm1_protocole,
        commentaire: carcasse.svi_ipm1_commentaire,
      },
    });
  }

  if (carcasse.svi_ipm2_signed_at) {
    events.push({
      date: new Date(carcasse.svi_ipm2_signed_at),
      label: 'IPM2 signé',
      data: {
        decision: carcasse.svi_ipm2_decision,
        commentaire: carcasse.svi_ipm2_commentaire,
      },
    });
  }

  if (carcasse.svi_carcasse_status_set_at) {
    events.push({
      date: new Date(carcasse.svi_carcasse_status_set_at),
      label: 'Statut final SVI',
      data: {
        status: carcasse.svi_carcasse_status,
      },
    });
  }

  events.sort((a, b) => {
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date.getTime() - b.date.getTime();
  });

  return events;
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YYYY HH:mm');
}

export default function AdminCarcassesIntermediaires() {
  const [rows, setRows] = useState<CarcasseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCarcasseId, setSelectedCarcasseId] = useState<string | null>(null);
  const [carcasseDetail, setCarcasseDetail] = useState<CarcasseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 100;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (debouncedSearch) query.search = debouncedSearch;
    API.get({ path: 'admin/carcasses', query })
      .then((res) => res as AdminCarcassesResponse)
      .then((res) => {
        if (res.ok) {
          setRows(res.data.carcasses);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  }, [offset, debouncedSearch]);

  useEffect(() => {
    if (!selectedCarcasseId) {
      setCarcasseDetail(null);
      return;
    }
    setLoadingDetail(true);
    API.get({ path: `admin/carcasse/${encodeURIComponent(selectedCarcasseId)}` })
      .then((res) => res as AdminCarcasseDetailResponse)
      .then((res) => {
        if (res.ok) {
          setCarcasseDetail(res.data.carcasse as CarcasseDetail);
        }
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedCarcasseId]);

  if (loading && rows.length === 0) {
    return <Chargement />;
  }

  const timeline = carcasseDetail ? buildTimeline(carcasseDetail) : [];

  return (
    <div className="flex gap-4 py-4">
      <div className={`${selectedCarcasseId ? 'w-3/5' : 'w-full'} overflow-x-auto`}>
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Carcasses ({total})</h3>
            <div className="flex items-center gap-2">
              <button
                className="fr-btn fr-btn--sm fr-btn--secondary"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Précédent
              </button>
              <span className="text-sm tabular-nums">
                {offset + 1}–{Math.min(offset + limit, total)} / {total}
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
          <input
            type="search"
            className="fr-input"
            placeholder="Rechercher par numéro de bracelet, numéro de FEI ou espèce…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-gray-100 text-left">
              <th className="p-1">bracelet</th>
              <th className="p-1">espèce</th>
              <th className="p-1">type</th>
              <th className="p-1">fei_numero</th>
              <th className="p-1">nb intermédiaires</th>
              <th className="p-1">created_at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.zacharie_carcasse_id}
                className={`cursor-pointer border-b hover:bg-blue-50 ${
                  selectedCarcasseId === row.zacharie_carcasse_id ? 'bg-blue-100' : ''
                }`}
                onClick={() => setSelectedCarcasseId(row.zacharie_carcasse_id)}
              >
                <td className="p-1">{row.numero_bracelet}</td>
                <td className="p-1">{row.espece}</td>
                <td className="p-1">{row.type}</td>
                <td className="max-w-[120px] truncate p-1" title={row.fei_numero}>
                  {row.fei_numero}
                </td>
                <td className="p-1">{row._count.CarcasseIntermediaire}</td>
                <td className="p-1">{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCarcasseId && (
        <div className="w-2/5 overflow-y-auto border-l pl-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold">Fil de vie</h3>
            <button
              className="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
              onClick={() => setSelectedCarcasseId(null)}
            >
              Fermer
            </button>
          </div>
          {loadingDetail ? (
            <Chargement />
          ) : carcasseDetail ? (
            <div className="space-y-4">
              <div className="text-sm">
                <strong>{carcasseDetail.numero_bracelet}</strong> — {carcasseDetail.espece} —{' '}
                {carcasseDetail.type}
              </div>

              {/* Timeline */}
              <div className="relative border-l-2 border-gray-300 pl-4">
                {timeline.map((event, i) => (
                  <div key={i} className="relative mb-4">
                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" />
                    <div className="text-xs text-gray-500">{event.date ? formatDate(event.date) : '—'}</div>
                    <div className="text-sm font-semibold">{event.label}</div>
                    {Object.keys(event.data).length > 0 && (
                      <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-1 text-xs text-gray-700">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              {/* CarcasseIntermediaire table */}
              {carcasseDetail.CarcasseIntermediaire.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-bold">
                    Intermédiaires ({carcasseDetail.CarcasseIntermediaire.length})
                  </h4>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-gray-100 text-left">
                        <th className="p-1">entité</th>
                        <th className="p-1">rôle</th>
                        <th className="p-1">prise en charge</th>
                        <th className="p-1">décision</th>
                        <th className="p-1">poids</th>
                        <th className="p-1">refus</th>
                        <th className="p-1">commentaire</th>
                        <th className="p-1">created_at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carcasseDetail.CarcasseIntermediaire.map((ci) => (
                        <tr
                          key={`${ci.fei_numero}_${ci.zacharie_carcasse_id}_${ci.intermediaire_id}`}
                          className="border-b"
                        >
                          <td className="max-w-[100px] truncate p-1" title={ci.CarcasseIntermediaireEntity.nom_d_usage}>
                            {ci.CarcasseIntermediaireEntity.nom_d_usage}
                          </td>
                          <td className="p-1">{ci.intermediaire_role}</td>
                          <td className="p-1">
                            {ci.prise_en_charge == null ? '—' : ci.prise_en_charge ? 'oui' : 'non'}
                          </td>
                          <td className="p-1">{formatDate(ci.decision_at)}</td>
                          <td className="p-1">{ci.intermediaire_poids ?? '—'}</td>
                          <td className="max-w-[80px] truncate p-1" title={ci.refus ?? ''}>
                            {ci.refus ?? '—'}
                          </td>
                          <td className="max-w-[80px] truncate p-1" title={ci.commentaire ?? ''}>
                            {ci.commentaire ?? '—'}
                          </td>
                          <td className="p-1">{formatDate(ci.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune donnée</p>
          )}
        </div>
      )}
    </div>
  );
}
