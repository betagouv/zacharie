import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Tabs } from '@codegouvfr/react-dsfr/Tabs';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { toast } from 'react-toastify';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import AdminDeletedBanner from '@app/components/AdminDeletedBanner';
import type { AdminFeiDetailResponse, AdminSoftDeleteResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';
import { formatOwner, getNextOwnerStatus } from '@app/utils/admin-fei-destinataire';
import { AdminHistoryTimeline } from './history-timeline';
import { AddCarcasseForm, IdentiteCorrectionForm, PremierDetenteurCorrectionForm } from './fei-corrections';

type FeiDetail = AdminFeiDetailResponse['data']['fei'];
type FeiDetailData = AdminFeiDetailResponse['data'];

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

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h4 className="mb-3 flex items-center justify-between border-b pb-2 text-base font-bold">
        {title}
        {onEdit && (
          <Button
            type="button"
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-edit-line"
            onClick={onEdit}
          >
            Modifier
          </Button>
        )}
      </h4>
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
  { tabId: 'historique' as const, label: 'Historique' },
];

type FeiTabId = (typeof feiTabs)[number]['tabId'];

export default function AdminFeiDetail() {
  const params = useParams<{ fei_numero: string }>();
  return (
    <>
      <title>{`Fiche ${params.fei_numero} | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <AdminFeiDetailContent />
    </>
  );
}

function AdminFeiDetailContent() {
  const params = useParams<{ fei_numero: string }>();
  const [fei, setFei] = useState<FeiDetail | null>(null);
  const [destinataires, setDestinataires] = useState<FeiDetailData['destinataires']>([]);
  const [ownerLabels, setOwnerLabels] = useState<FeiDetailData['ownerLabels']>({});
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<FeiTabId>('infos');
  const [isDeleting, setIsDeleting] = useState(false);
  const [corrections, setCorrections] = useState<FeiDetailData['corrections'] | null>(null);
  const [editing, setEditing] = useState<'identite' | 'premier-detenteur' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!params.fei_numero) return;
    if (reloadKey === 0) setLoading(true);
    API.get({ path: `admin/fei/${encodeURIComponent(params.fei_numero)}` })
      .then((res) => res as AdminFeiDetailResponse)
      .then((res) => {
        if (res.ok) {
          setFei(res.data.fei);
          setDestinataires(res.data.destinataires);
          setOwnerLabels(res.data.ownerLabels);
          setCorrections(res.data.corrections);
        }
      })
      .finally(() => setLoading(false));
  }, [params.fei_numero, reloadKey]);

  if (loading) return <Chargement />;
  if (!fei) return <p className="py-8 text-center text-gray-500">Fiche introuvable</p>;

  function ownerLabel(entityId: string | null, userId: string | null) {
    const id = entityId ?? userId;
    if (!id) return null;
    return ownerLabels[id] ?? id;
  }

  const canCorrect = !!corrections && !corrections.blocage;

  function handleCorrectionSaved() {
    setEditing(null);
    setReloadKey((key) => key + 1);
    toast.success('La fiche a été corrigée');
  }

  function handleCarcasseSoftDelete(carcasse: FeiDetail['Carcasses'][number]) {
    if (!window.confirm(`Supprimer la carcasse ${carcasse.numero_bracelet} de cette fiche ?`)) return;
    API.post({ path: `admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}/soft-delete` })
      .then((res) => res as AdminSoftDeleteResponse)
      .then((response) => {
        if (!response.ok) return toast.error(response.error);
        setReloadKey((key) => key + 1);
        toast.success('La carcasse a été supprimée');
      });
  }

  function handleSoftDelete() {
    if (!fei) return;
    const confirmMessage = `Supprimer la fiche ${fei.numero} et ses ${fei.Carcasses.length} carcasse(s) ? Elles disparaîtront de l'application et des statistiques.`;
    if (!window.confirm(confirmMessage)) return;
    setIsDeleting(true);
    API.post({ path: `admin/fei/${encodeURIComponent(fei.numero)}/soft-delete` })
      .then((res) => res as AdminSoftDeleteResponse)
      .then((response) => {
        if (!response.ok || !response.data) {
          return toast.error(response.error);
        }
        setFei({ ...fei, deleted_at: response.data.deleted_at });
        toast.success('La fiche a été supprimée');
      })
      .finally(() => setIsDeleting(false));
  }

  return (
    <>
      {fei.deleted_at && (
        <AdminDeletedBanner
          label="Fiche supprimée"
          deletedAt={fei.deleted_at}
        />
      )}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="mb-0 text-xl font-bold">Fiche {fei.numero}</h2>
            <p className="mb-0 text-sm text-gray-500">
              {formatDateOnly(fei.date_mise_a_mort)}
              {fei.commune_mise_a_mort ? ` · ${fei.commune_mise_a_mort}` : ''}
              {` · ${fei.Carcasses.length} carcasse(s)`}
            </p>
            {corrections?.blocage && !fei.deleted_at && (
              <p className="mb-0 text-sm text-gray-500">{corrections.blocage} : corrections impossibles</p>
            )}
          </div>
          {!fei.deleted_at && (
            <Button
              type="button"
              priority="tertiary"
              size="small"
              iconId="fr-icon-delete-line"
              className="text-red-600! [&_*]:text-red-600! [&:hover]:bg-red-50!"
              disabled={isDeleting}
              onClick={handleSoftDelete}
            >
              Supprimer
            </Button>
          )}
        </div>
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
            <Section
              title="Identité"
              onEdit={canCorrect && !editing ? () => setEditing('identite') : undefined}
            >
              {editing === 'identite' && (
                <IdentiteCorrectionForm
                  fei={fei}
                  onCancel={() => setEditing(null)}
                  onSaved={handleCorrectionSaved}
                />
              )}
              <FieldGrid>
                <Field label="Numéro">{fei.numero}</Field>
                <Field label="Date de mise à mort">{formatDateOnly(fei.date_mise_a_mort)}</Field>
                <Field label="Commune de prélèvement du gibier">{fei.commune_mise_a_mort ?? '—'}</Field>
                <Field label="Heure mise à mort (1ère carcasse)">
                  {fei.heure_mise_a_mort_premiere_carcasse ?? '—'}
                </Field>
                <Field label="Heure éviscération (dernière carcasse)">
                  {fei.heure_evisceration_derniere_carcasse ?? '—'}
                </Field>
                <Field label="Créée par (user ID)">{fei.created_by_user_id}</Field>
                <Field label="Contexte de création">{fei.creation_context ?? '—'}</Field>
                <Field label="Créée le">{formatDate(fei.created_at)}</Field>
                <Field label="Mise à jour le">{formatDate(fei.updated_at)}</Field>
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
            <Section
              title="Premier détenteur"
              onEdit={canCorrect && !editing ? () => setEditing('premier-detenteur') : undefined}
            >
              {editing === 'premier-detenteur' && corrections && (
                <PremierDetenteurCorrectionForm
                  fei={fei}
                  corrections={corrections}
                  onCancel={() => setEditing(null)}
                  onSaved={handleCorrectionSaved}
                />
              )}
              <FieldGrid>
                <Field label="Nom (cache)">{fei.premier_detenteur_name_cache ?? '—'}</Field>
                <Field label="Utilisateur">{fei.FeiPremierDetenteurUser?.email ?? '—'}</Field>
                <Field label="Entité">{fei.FeiPremierDetenteurEntity?.nom_d_usage ?? '—'}</Field>
              </FieldGrid>
            </Section>

            {/* 4. SVI */}
            {/* <Section title="SVI">
              <FieldGrid>
                <Field label="Entité SVI">{fei.FeiSviEntity?.nom_d_usage ?? '—'}</Field>
                <Field label="Utilisateur SVI">{fei.FeiSviUser?.email ?? '—'}</Field>
              </FieldGrid>
            </Section> */}
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
                        <th className="p-2">Détenteur actuel</th>
                        <th className="p-2">Destinataire</th>
                        <th className="p-2">Statut SVI</th>
                        <th className="p-2">Nb intermédiaires</th>
                        {canCorrect && <th className="p-2" />}
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
                            {formatOwner(
                              ownerLabel(carcasse.current_owner_entity_id, carcasse.current_owner_user_id),
                              carcasse.current_owner_role
                            )}
                          </td>
                          <td className="p-2">
                            {formatOwner(
                              ownerLabel(carcasse.next_owner_entity_id, carcasse.next_owner_user_id),
                              carcasse.next_owner_role
                            )}
                          </td>
                          <td className="p-2">
                            <StatusBadge status={carcasse.svi_carcasse_status} />
                          </td>
                          <td className="p-2">{carcasse._count.CarcasseIntermediaire}</td>
                          {canCorrect && (
                            <td className="p-2">
                              {!carcasse.deleted_at && (
                                <Button
                                  type="button"
                                  priority="tertiary no outline"
                                  size="small"
                                  iconId="fr-icon-delete-line"
                                  title={`Supprimer la carcasse ${carcasse.numero_bracelet}`}
                                  className="text-red-600! [&_*]:text-red-600!"
                                  onClick={() => handleCarcasseSoftDelete(carcasse)}
                                />
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {corrections &&
                (corrections.ajoutCarcasseBlocage ? (
                  !corrections.blocage && (
                    <p className="mt-4 mb-0 text-sm text-gray-500">
                      Ajout de carcasse impossible : {corrections.ajoutCarcasseBlocage.toLowerCase()}. C'est à
                      lui de l'ajouter (« Ajouter une carcasse manquante »).
                    </p>
                  )
                ) : (
                  <AddCarcasseForm
                    fei={fei}
                    onSaved={() => handleCorrectionSaved()}
                  />
                ))}
            </Section>
          </div>
        )}

        {selectedTab === 'intermediaires' && (
          <div className="flex flex-col gap-4 pt-2">
            {/* 6. Destinataires, lus sur les carcasses : couvre aussi ceux qui n'ont pas pris en charge et le circuit court */}
            <Section title="Destinataires">
              {destinataires.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune carcasse</p>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="p-2">Détenteur actuel</th>
                      <th className="p-2">Destinataire</th>
                      <th className="p-2">Carcasses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {destinataires.map((destinataire, index) => (
                      <tr
                        key={index}
                        className="border-b"
                      >
                        <td className="p-2">
                          {formatOwner(destinataire.current_owner_label, destinataire.current_owner_role)}
                        </td>
                        <td className="p-2">
                          {formatOwner(destinataire.next_owner_label, destinataire.next_owner_role)}
                          {destinataire.next_owner_role && (
                            <span className="block text-gray-400">
                              {getNextOwnerStatus(destinataire.next_owner_role)}
                            </span>
                          )}
                        </td>
                        <td className="p-2">{destinataire.nb_carcasses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {/* 7. Intermédiaires */}
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
        {selectedTab === 'historique' && (
          <AdminHistoryTimeline
            type="fei"
            id={fei.numero}
          />
        )}
      </Tabs>
    </>
  );
}
