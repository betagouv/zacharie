import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';
import { CarcasseStatus, CarcasseType } from '@prisma/client';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Tooltip as DsfrTooltip } from '@codegouvfr/react-dsfr/Tooltip';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EtgUserInteractedResponse, EtgUserInteracted } from '@api/src/types/responses';
import API from '@app/services/api';
import useZustandStore from '@app/zustand/store';
import Chargement from '@app/components/Chargement';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import { getCarcasseStatusLabel, type CarcasseStatusLabel } from '@app/utils/get-carcasse-status';
import { hasBphMotif, isBphMotif } from '@app/utils/bph-motifs';
import { loadData, useLoaderEffect } from '@app/utils/load-data';

function getUserName(user: EtgUserInteracted) {
  const name = `${user.prenom ?? ''} ${user.nom_de_famille ?? ''}`.trim();
  return name || user.email || 'Utilisateur sans nom';
}

export default function EtgUtilisateur() {
  const { userId } = useParams();
  const [user, setUser] = useState<EtgUserInteracted | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState('Statistiques de saisies');

  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setUser(null);
    setNotFound(false);
    API.get({ path: `entite/etg/utilisateurs/${userId}` })
      .then((res) => res as EtgUserInteractedResponse)
      .then((res) => {
        if (res.ok && res.data) {
          setUser(res.data.user);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [userId]);

  useLoaderEffect(() => {
    loadData('etg-utilisateur');
  }, []);

  // carcasses de l'utilisateur dans le périmètre ETG (déjà scopé dans le store)
  const userCarcasses = useMemo(() => {
    if (!userId) return [];
    const interCarcasseIds = new Set<string>();
    for (const ci of Object.values(carcassesIntermediaireById)) {
      if (ci.deleted_at) continue;
      if (ci.intermediaire_user_id === userId) interCarcasseIds.add(ci.zacharie_carcasse_id);
    }
    return carcassesRegistry.filter(
      (c) =>
        c.premier_detenteur_user_id === userId ||
        c.examinateur_initial_user_id === userId ||
        c.svi_user_id === userId ||
        c.svi_ipm1_user_id === userId ||
        c.svi_ipm2_user_id === userId ||
        interCarcasseIds.has(c.zacharie_carcasse_id)
    );
  }, [carcassesRegistry, carcassesIntermediaireById, userId]);

  if (notFound) {
    return (
      <div className="fr-container p-8 text-center">
        <title>{`Utilisateur introuvable | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
        <p className="text-gray-600">
          Cet utilisateur n'existe pas ou n'a pas interagi avec votre établissement.
        </p>
        <Link
          className="fr-link"
          to="/app/etg/utilisateurs"
        >
          Retour à la liste des utilisateurs
        </Link>
      </div>
    );
  }

  if (!user) {
    return <Chargement />;
  }

  const fullName = getUserName(user);
  const localisation = [user.code_postal, user.ville].filter(Boolean).join(' ');

  const tabs: TabsProps['tabs'] = [{ tabId: 'Statistiques de saisies', label: 'Statistiques de saisies' }];

  return (
    <div className="fr-container fr-container--fluid">
      <title>{`${fullName} | Utilisateurs | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="p-4 pb-32 md:p-8 md:pb-0">
        <Link
          className="fr-link fr-icon-arrow-left-line fr-link--icon-left mb-4 inline-block"
          to="/app/etg/utilisateurs"
        >
          Retour à la liste
        </Link>

        <header className="rounded-lg border border-gray-200 bg-white p-3 md:p-4">
          <h1 className="m-0 text-xl font-bold break-words">{fullName}</h1>
          {fullName !== user.email && user.email && (
            <p className="m-0 text-sm break-words text-gray-500">{user.email}</p>
          )}

          {user.roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {user.roles.map((role) => (
                <Tag
                  key={role}
                  small
                >
                  {getUserRoleLabel(role)}
                </Tag>
              ))}
            </div>
          )}

          <p className="mt-2 mb-0 text-xs text-gray-500">
            {user.telephone && <>{user.telephone} · </>}
            {localisation && <>{localisation} · </>}
            Inscrit le {dayjs(user.created_at).format('DD/MM/YYYY')}
          </p>
        </header>

        <Tabs
          selectedTabId={selectedTabId}
          tabs={tabs}
          onTabChange={setSelectedTabId}
          className="mt-4"
        >
          {selectedTabId === 'Statistiques de saisies' && <SaisieStats carcasses={userCarcasses} />}
        </Tabs>
      </div>
    </div>
  );
}

// Libellé de statut unifié (masculin/féminin fusionnés pour ne pas dédoubler les parts du donut).
type StatusDisplayLabel =
  | 'Saisie totale'
  | 'Saisie partielle'
  | 'En traitement assainissant'
  | 'Consigné(e)'
  | 'Levée de consigne'
  | 'Accepté(e)'
  | 'Manquant(e)'
  | 'Sans décision';

function normalizeStatusLabel(label: CarcasseStatusLabel): StatusDisplayLabel {
  switch (label) {
    case 'Accepté':
    case 'Acceptée':
      return 'Accepté(e)';
    case 'Consigné':
    case 'Consignée':
      return 'Consigné(e)';
    case 'Manquant':
    case 'Manquante':
      return 'Manquant(e)';
    default:
      return label;
  }
}

// Couleur stable par statut SVI (même statut = même couleur d'un utilisateur à l'autre).
const STATUS_COLORS: Record<StatusDisplayLabel, string> = {
  'Saisie totale': '#e1000f', // rouge
  'Saisie partielle': '#fa5252', // rouge clair
  'En traitement assainissant': '#7048e8', // violet
  'Consigné(e)': '#f59f00', // ambre
  'Levée de consigne': '#37b24d', // vert
  'Accepté(e)': '#1971c2', // bleu
  'Manquant(e)': '#868e96', // gris
  'Sans décision': '#ced4da', // gris clair
};
const BPH_COLOR = '#e1000f';
const NON_BPH_COLOR = '#3b82f6';

function SaisieStats({ carcasses }: { carcasses: Array<Carcasse> }) {
  const stats = useMemo(() => {
    const total = carcasses.length;
    const statusCounts = new Map<StatusDisplayLabel, number>();
    const motifCounts = new Map<string, number>();
    let totalGG = 0;
    let totalPG = 0;
    let saisiesCount = 0;
    let saisiesGG = 0;
    let saisiesPG = 0;
    let saisiesBphCount = 0;
    for (const carcasse of carcasses) {
      const isPetitGibier = carcasse.type === CarcasseType.PETIT_GIBIER;
      if (isPetitGibier) totalPG += 1;
      else totalGG += 1;

      const statusLabel = normalizeStatusLabel(getCarcasseStatusLabel(carcasse));
      statusCounts.set(statusLabel, (statusCounts.get(statusLabel) ?? 0) + 1);

      const motifs = [
        ...(carcasse.svi_ipm1_lesions_ou_motifs ?? []),
        ...(carcasse.svi_ipm2_lesions_ou_motifs ?? []),
      ].filter(Boolean);
      for (const motif of motifs) {
        motifCounts.set(motif, (motifCounts.get(motif) ?? 0) + 1);
      }

      const isSaisie =
        carcasse.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
        carcasse.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE;
      if (isSaisie) {
        saisiesCount += 1;
        if (isPetitGibier) saisiesPG += 1;
        else saisiesGG += 1;
        if (hasBphMotif(motifs)) saisiesBphCount += 1;
      }
    }
    const statusData = [...statusCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        color: STATUS_COLORS[name],
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
    const motifData = [...motifCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([motif, count]) => ({ motif, count, bph: isBphMotif(motif) }));
    return {
      total,
      totalGG,
      totalPG,
      statusData,
      motifData,
      saisiesCount,
      saisiesBphCount,
      tauxSaisie: total > 0 ? Math.round((saisiesCount / total) * 1000) / 10 : 0,
      tauxSaisieGG: totalGG > 0 ? Math.round((saisiesGG / totalGG) * 1000) / 10 : 0,
      tauxSaisiePG: totalPG > 0 ? Math.round((saisiesPG / totalPG) * 1000) / 10 : 0,
      tauxBph: saisiesCount > 0 ? Math.round((saisiesBphCount / saisiesCount) * 1000) / 10 : 0,
    };
  }, [carcasses]);

  if (carcasses.length === 0) {
    return (
      <div className="py-4">
        <p className="text-sm text-gray-500">Aucune carcasse pour cet utilisateur.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-wrap gap-4">
        <StatCard
          label="Grand gibier"
          value={stats.totalGG}
        />
        <StatCard
          label="Petit gibier"
          value={stats.totalPG}
        />
        <StatCard
          label="Taux de saisie"
          value={`${stats.tauxSaisie.toLocaleString('fr-FR')} %`}
          sub={`Grand gibier : ${stats.tauxSaisieGG.toLocaleString('fr-FR')} % · Petit gibier : ${stats.tauxSaisiePG.toLocaleString('fr-FR')} %`}
        />
        <StatCard
          label="Saisies liées au BPH"
          value={`${stats.tauxBph.toLocaleString('fr-FR')} %`}
          sub={`${stats.saisiesBphCount} saisie${stats.saisiesBphCount > 1 ? 's' : ''} sur ${stats.saisiesCount} (hygiène)`}
          info="BPH = Bonnes Pratiques d'Hygiène. Saisies dont au moins un motif relève d'un défaut d'hygiène (souillures, putréfaction, morsures…), souvent évitable lors de la préparation."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="fr-h6 mb-3">Répartition par décision SVI</h3>
          <ResponsiveContainer
            width="100%"
            height={220}
          >
            <PieChart>
              <Pie
                data={stats.statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
              >
                {stats.statusData.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.color}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [Number(v).toLocaleString('fr-FR'), String(n)]} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-3 flex flex-col gap-1">
            {stats.statusData.map((d) => (
              <li
                key={d.name}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color }}
                />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="font-semibold text-gray-900">{d.value}</span>
                <span className="w-10 text-right text-gray-500">{d.pct}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="fr-h6 mb-1">Motifs de saisie</h3>
          <p className="mb-3 text-xs text-gray-500">
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ backgroundColor: BPH_COLOR }}
            />
            Motif lié aux Bonnes Pratiques d'Hygiène (BPH)
          </p>
          {stats.motifData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucun motif de saisie renseigné.</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(220, stats.motifData.length * 28)}
            >
              <BarChart
                data={stats.motifData}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="motif"
                  type="category"
                  width={160}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(v) => [Number(v).toLocaleString('fr-FR'), 'Nombre']} />
                <Bar
                  dataKey="count"
                  name="Nombre de carcasses"
                >
                  {stats.motifData.map((d) => (
                    <Cell
                      key={d.motif}
                      fill={d.bph ? BPH_COLOR : NON_BPH_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  info,
}: {
  label: string;
  value: string | number;
  sub?: string;
  info?: string;
}) {
  return (
    <div className="flex min-w-48 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4">
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      <span className="flex items-center gap-1 text-sm text-gray-600">
        {label}
        {info && (
          <DsfrTooltip
            kind="hover"
            title={info}
          />
        )}
      </span>
      {sub && <span className="mt-1 text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
