import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Tabs } from '@codegouvfr/react-dsfr/Tabs';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { AdminFeiDetailResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';

type FeiDetail = AdminFeiDetailResponse['data']['fei'];

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

const feiTabs = [
  { tabId: 'infos' as const, label: 'Informations' },
  { tabId: 'carcasses' as const, label: 'Carcasses' },
  { tabId: 'intermediaires' as const, label: 'Intermédiaires' },
];

type FeiTabId = (typeof feiTabs)[number]['tabId'];

export default function AdminFeiDetail() {
  const params = useParams<{ fei_numero: string }>();
  const [fei, setFei] = useState<FeiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<FeiTabId>('infos');

  useEffect(() => {
    if (!params.fei_numero) return;
    setLoading(true);
    API.get({ path: `admin/fei/${encodeURIComponent(params.fei_numero)}` })
      .then((res) => res as AdminFeiDetailResponse)
      .then((res) => {
        if (res.ok) {
          setFei(res.data.fei);
        }
      })
      .finally(() => setLoading(false));
  }, [params.fei_numero]);

  if (loading) return <Chargement />;
  if (!fei) return <p className="py-8 text-center text-gray-500">Fiche introuvable</p>;

  return (
    <>
      <Link
        to="/app/admin/feis"
        className="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
      >
        <span
          className="fr-icon-arrow-left-line fr-icon--sm mr-1"
          aria-hidden="true"
        />
        Retour à la liste
      </Link>

      <header className="mt-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-0 text-xl font-bold">Fiche {fei.numero}</h2>
        <p className="mb-0 text-sm text-gray-500">
          {formatDateOnly(fei.date_mise_a_mort)}
          {fei.commune_mise_a_mort ? ` · ${fei.commune_mise_a_mort}` : ''}
          {` · ${fei.Carcasses.length} carcasse(s)`}
        </p>
      </header>

      <Tabs
        className="mt-4"
        selectedTabId={selectedTab}
        tabs={feiTabs}
        onTabChange={(tabId) => setSelectedTab(tabId as FeiTabId)}
      >
        {selectedTab === 'infos' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 1. Identité fiche */}
            <Section title="Identité">
              <FieldGrid>
                <Field label="Numéro">{fei.numero}</Field>
                <Field label="Date de mise à mort">{formatDateOnly(fei.date_mise_a_mort)}</Field>
                <Field label="Commune de mise à mort">{fei.commune_mise_a_mort ?? '—'}</Field>
                <Field label="Heure mise à mort (1ère carcasse)">
                  {fei.heure_mise_a_mort_premiere_carcasse ?? '—'}
                </Field>
                <Field label="Heure éviscération (dernière carcasse)">
                  {fei.heure_evisceration_derniere_carcasse ?? '—'}
                </Field>
                <Field label="Créée par (user ID)">{fei.created_by_user_id}</Field>
                <Field label="Contexte de création">{fei.creation_context ?? '—'}</Field>
                <Field label="Résumé nombre de carcasses">{fei.resume_nombre_de_carcasses ?? '—'}</Field>
                {fei.automatic_closed_at && (
                  <Field label="Clôturée automatiquement le">{formatDate(fei.automatic_closed_at)}</Field>
                )}
                <Field label="Créée le">{formatDate(fei.created_at)}</Field>
                <Field label="Mise à jour le">{formatDate(fei.updated_at)}</Field>
                {fei.deleted_at && <Field label="Supprimée le">{formatDate(fei.deleted_at)}</Field>}
              </FieldGrid>
            </Section>

            {/* 2. Examinateur initial */}
            <Section title="Examinateur initial">
              <FieldGrid>
                <Field label="Examinateur">{fei.FeiExaminateurInitialUser?.email ?? '—'}</Field>
                <Field label="Approbation mise sur le marché">
                  {fei.examinateur_initial_approbation_mise_sur_le_marche == null
                    ? '—'
                    : fei.examinateur_initial_approbation_mise_sur_le_marche
                      ? 'Oui'
                      : 'Non'}
                </Field>
                {fei.examinateur_initial_date_approbation_mise_sur_le_marche && (
                  <Field label="Date approbation">
                    {formatDate(fei.examinateur_initial_date_approbation_mise_sur_le_marche)}
                  </Field>
                )}
                {fei.consommateur_final_usage_domestique && (
                  <Field label="Consommateur final usage domestique">
                    {formatDate(fei.consommateur_final_usage_domestique)}
                  </Field>
                )}
              </FieldGrid>
            </Section>

            {/* 3. Premier détenteur */}
            <Section title="Premier détenteur">
              <FieldGrid>
                <Field label="Nom (cache)">{fei.premier_detenteur_name_cache ?? '—'}</Field>
                <Field label="Utilisateur">{fei.FeiPremierDetenteurUser?.email ?? '—'}</Field>
                <Field label="Entité">{fei.FeiPremierDetenteurEntity?.nom_d_usage ?? '—'}</Field>
              </FieldGrid>
            </Section>

            {/* 4. SVI */}
            <Section title="SVI">
              <FieldGrid>
                <Field label="Entité SVI">{fei.FeiSviEntity?.nom_d_usage ?? '—'}</Field>
                <Field label="Utilisateur SVI">{fei.FeiSviUser?.email ?? '—'}</Field>
              </FieldGrid>
            </Section>
          </div>
        )}

        {selectedTab === 'carcasses' && (
          <div className="pt-2">
            {/* 5. Carcasses */}
            <Section title={`Carcasses (${fei.Carcasses.length})`}>
              {fei.Carcasses.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune carcasse</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="p-2">Marquage</th>
                        <th className="p-2">Espèce</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Statut SVI</th>
                        <th className="p-2">Nb intermédiaires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fei.Carcasses.map((carcasse) => (
                        <tr
                          key={carcasse.zacharie_carcasse_id}
                          className="border-b"
                        >
                          <td className="p-2">
                            <Link
                              to={`/app/admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}`}
                              className="text-blue-600 underline"
                            >
                              {carcasse.numero_bracelet}
                            </Link>
                          </td>
                          <td className="p-2">{carcasse.espece ?? '—'}</td>
                          <td className="p-2">{carcasse.type ?? '—'}</td>
                          <td className="p-2">
                            <StatusBadge status={carcasse.svi_carcasse_status} />
                          </td>
                          <td className="p-2">{carcasse._count.CarcasseIntermediaire}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}

        {selectedTab === 'intermediaires' && (
          <div className="pt-2">
            {/* 6. Intermédiaires */}
            {fei.CarcasseIntermediaire.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">Aucun intermédiaire</p>
            ) : (
              <Section title={`Intermédiaires (${fei.CarcasseIntermediaire.length})`}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="p-2">Entité</th>
                        <th className="p-2">Type entité</th>
                        <th className="p-2">Utilisateur</th>
                        <th className="p-2">Rôle</th>
                        <th className="p-2">Marquage</th>
                        <th className="p-2">Prise en charge</th>
                        <th className="p-2">Décision</th>
                        <th className="p-2">Poids</th>
                        <th className="p-2">Refus</th>
                        <th className="p-2">Commentaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fei.CarcasseIntermediaire.map((ci) => (
                        <tr
                          key={`${ci.fei_numero}_${ci.zacharie_carcasse_id}_${ci.intermediaire_id}`}
                          className="border-b"
                        >
                          <td className="p-2">{ci.CarcasseIntermediaireEntity.nom_d_usage}</td>
                          <td className="p-2">{ci.CarcasseIntermediaireEntity.type}</td>
                          <td className="p-2">{ci.CarcasseIntermediaireUser.email}</td>
                          <td className="p-2">{ci.intermediaire_role ?? '—'}</td>
                          <td className="p-2">{ci.numero_bracelet}</td>
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
                          <td
                            className="max-w-[120px] truncate p-2"
                            title={ci.commentaire ?? ''}
                          >
                            {ci.commentaire ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>
        )}
      </Tabs>
    </>
  );
}
