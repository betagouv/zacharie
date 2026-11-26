import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { UserRoles } from '@prisma/client';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import Alert from '@codegouvfr/react-dsfr/Alert';
import { createModal } from '@app/components/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import CarcasseExamenInitialForm from '@app/components/CarcasseExamenInitialForm';
import { formatCarcasseLotCount } from '@app/utils/count-carcasses';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import CardCarcasse from '@app/components/CardCarcasse';
import LazyModal from '@app/components/LazyModal';
import { useLazyModal } from '@app/utils/use-lazy-modal';
import { isCarcasseDejaEnvoyee, isCarcassePriseEnChargeEnAval } from '@app/utils/carcasse-deja-envoyee';
import type { Carcasse } from '@prisma/client';
import { lookupAnomalie } from '@app/utils/anomalies-referentiel';
import { USAGE_DOMESTIQUE_ID, USAGE_DOMESTIQUE_LABEL } from '@app/utils/usage-domestique';
import { track } from '@app/services/matomo';
import { syncData } from '@app/utils/sync-data';

function alertSeverity(alertLevel: number | null): 'info' | 'warning' | 'error' {
  if (alertLevel === 4) return 'error';
  if (alertLevel === 1) return 'info';
  return 'warning';
}

export default function CarcassesExaminateur({
  canEdit,
  canEditAsPremierDetenteur,
  allCarcassesConfirmed,
  onAllCarcassesConfirmed,
}: {
  canEdit: boolean;
  canEditAsPremierDetenteur: boolean;
  allCarcassesConfirmed: boolean;
  onAllCarcassesConfirmed: () => void;
}) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei_numero = params.fei_numero!;
  const fei = feis[fei_numero];
  const entities = useZustandStore((state) => state.entities);
  const carcasses = useCarcassesForFei(params.fei_numero);

  const hasCarcasses = carcasses.length > 0;
  const lastEspece = hasCarcasses ? carcasses[carcasses.length - 1].espece : null;

  const { restantes, renvoyeesParDestinataire, dejaEnvoyeesParDestinataire } = useMemo(() => {
    const restantesList: Carcasse[] = [];
    const renvoyees: Record<string, Carcasse[]> = {};
    const grouped: Record<string, Carcasse[]> = {};
    for (const c of carcasses) {
      if (!isCarcasseDejaEnvoyee(c)) {
        const renvoyeurId = c.premier_detenteur_prochain_detenteur_id_cache;
        if (!renvoyeurId) {
          restantesList.push(c);
          continue;
        }
        if (!renvoyees[renvoyeurId]) renvoyees[renvoyeurId] = [];
        renvoyees[renvoyeurId].push(c);
        continue;
      }
      const destinataireId = c.consommateur_final_usage_domestique
        ? USAGE_DOMESTIQUE_ID
        : c.premier_detenteur_prochain_detenteur_id_cache!;
      if (!grouped[destinataireId]) grouped[destinataireId] = [];
      grouped[destinataireId].push(c);
    }
    return {
      restantes: restantesList,
      renvoyeesParDestinataire: renvoyees,
      dejaEnvoyeesParDestinataire: grouped,
    };
  }, [carcasses]);

  const hasGroups =
    Object.keys(dejaEnvoyeesParDestinataire).length > 0 || Object.keys(renvoyeesParDestinataire).length > 0;

  const confirmModal = useRef(
    createModal({ id: `carcasse-confirm-${fei.numero}`, isOpenedByDefault: false })
  ).current;

  const addModal = useRef(
    createModal({ id: `carcasse-add-${fei.numero}`, isOpenedByDefault: false })
  ).current;
  const isAddModalOpen = useIsModalOpen(addModal);

  const addSubmitRef = useRef<(() => void) | null>(null);
  const [addFooter, setAddFooter] = useState({ label: 'Ajouter la carcasse', disabled: true });
  const onAddFooterChange = useCallback((f: { label: string; disabled: boolean }) => setAddFooter(f), []);

  const openAddModal = () => addModal.open();

  const { total: anomaliesTotal, avecMessage: anomaliesAvecMessage } = useMemo(() => {
    let total = 0;
    const seen = new Set<string>();
    const avecMessage: Array<{ canonical: string; message: string; alertLevel: number | null }> = [];
    for (const carcasse of carcasses) {
      const canonicals = [
        ...(carcasse.examinateur_anomalies_carcasse ?? []),
        ...(carcasse.examinateur_anomalies_abats ?? []),
      ];
      total += canonicals.length;
      for (const canonical of canonicals) {
        if (seen.has(canonical)) continue;
        seen.add(canonical);
        const found = lookupAnomalie(canonical);
        if (found?.item.message) {
          avecMessage.push({
            canonical: found.canonical,
            message: found.item.message,
            alertLevel: found.item.alert_level,
          });
        }
      }
    }
    avecMessage.sort((a, b) => (b.alertLevel ?? 0) - (a.alertLevel ?? 0));
    return { total, avecMessage };
  }, [carcasses]);

  const shouldConfirmWithModal = anomaliesAvecMessage.length > 0 || anomaliesTotal === 0;

  const renderCarcasseCard = (carcasse: Carcasse) => (
    <CarcasseExaminateur
      key={carcasse.zacharie_carcasse_id}
      carcasse={carcasse}
      canEditAsExaminateurInitial={canEdit}
      canEditAsPremierDetenteur={canEditAsPremierDetenteur}
    />
  );

  return (
    <>
      {hasGroups ? (
        <div className="flex flex-col gap-4">
          {(restantes.length > 0 || canEdit) && (
            <div>
              {restantes.length > 0 && (
                <p className="mt-0 mb-2 text-sm text-gray-500">
                  À attribuer ({formatCarcasseLotCount(restantes)})
                </p>
              )}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {restantes.map(renderCarcasseCard)}
                {canEdit && (
                  <AddCarcasseCard
                    id="add-more-carcasses-button"
                    onClick={openAddModal}
                  />
                )}
              </div>
            </div>
          )}
          {Object.entries(renvoyeesParDestinataire).map(([entityId, group]) => (
            <div key={`renvoi-${entityId}`}>
              <p className="mt-0 mb-2 text-sm text-gray-500">
                Renvoyée par {entities[entityId]?.nom_d_usage ?? 'le destinataire'}, à attribuer de nouveau (
                {formatCarcasseLotCount(group)})
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{group.map(renderCarcasseCard)}</div>
            </div>
          ))}
          {Object.entries(dejaEnvoyeesParDestinataire).map(([entityId, group]) => (
            <div key={entityId}>
              <p className="mt-0 mb-2 text-sm text-gray-500">
                {entityId === USAGE_DOMESTIQUE_ID
                  ? USAGE_DOMESTIQUE_LABEL
                  : `Envoyée à ${entities[entityId]?.nom_d_usage ?? 'destinataire inconnu'}`}{' '}
                ({formatCarcasseLotCount(group)})
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{group.map(renderCarcasseCard)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {carcasses.map(renderCarcasseCard)}
          {canEdit && (
            <AddCarcasseCard
              id="add-more-carcasses-button"
              onClick={openAddModal}
            />
          )}
        </div>
      )}
      {canEdit && hasCarcasses && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {!allCarcassesConfirmed && (
            <Button
              type="button"
              priority="primary"
              onClick={() => (shouldConfirmWithModal ? confirmModal.open() : onAllCarcassesConfirmed())}
            >
              Continuer
            </Button>
          )}
          <span className="text-sm text-gray-500">
            Total : {carcasses.length} carcasse{carcasses.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
      {canEdit && (
        <addModal.Component
          size="large"
          title="Ajouter une carcasse"
          buttons={[
            {
              children: addFooter.label,
              disabled: addFooter.disabled,
              doClosesModal: false,
              onClick: () => addSubmitRef.current?.(),
            },
          ]}
        >
          {isAddModalOpen && (
            <NouvelleCarcasse
              key={`${fei.commune_mise_a_mort}-${lastEspece}`}
              defaultEspece={lastEspece ?? undefined}
              onCarcasseAdded={() => addModal.close()}
              footerRef={addSubmitRef}
              onFooterChange={onAddFooterChange}
            />
          )}
        </addModal.Component>
      )}
      {canEdit && hasCarcasses && (
        <>
          {anomaliesAvecMessage.length > 0 ? (
            <confirmModal.Component
              title="Anomalies renseignées"
              buttons={[
                {
                  children: 'Annuler',
                  priority: 'secondary',
                  doClosesModal: true,
                },
                {
                  children: 'Continuer',
                  doClosesModal: true,
                  onClick: () => onAllCarcassesConfirmed(),
                },
              ]}
            >
              <div className="flex flex-col gap-4">
                <p className="mb-0">
                  Vous avez renseigné {anomaliesTotal} anomalie{anomaliesTotal > 1 ? 's' : ''}.
                </p>
                {anomaliesAvecMessage.map(({ canonical, message, alertLevel }) => (
                  <Alert
                    key={canonical}
                    severity={alertSeverity(alertLevel)}
                    title={canonical}
                    description={message}
                  />
                ))}
              </div>
            </confirmModal.Component>
          ) : anomaliesTotal === 0 ? (
            <confirmModal.Component
              title="Aucune anomalie renseignée"
              buttons={[
                {
                  children: 'Annuler',
                  priority: 'secondary',
                  doClosesModal: true,
                },
                {
                  children: 'Continuer',
                  doClosesModal: true,
                  onClick: () => onAllCarcassesConfirmed(),
                },
              ]}
            >
              <Alert
                severity="info"
                small
                description="Vous n'avez pas renseigné d'anomalie. Cela implique que l'examen initial des carcasses n'a pas détecté d'anomalies sur les carcasses, les abats ou le comportement de l'animal."
              />
            </confirmModal.Component>
          ) : null}
        </>
      )}
    </>
  );
}

export const CarcasseExaminateur = memo(function CarcasseExaminateur({
  carcasse,
  canEditAsPremierDetenteur,
  canEditAsExaminateurInitial,
}: {
  carcasse: Carcasse;
  canEditAsPremierDetenteur?: boolean;
  canEditAsExaminateurInitial?: boolean;
}) {
  const user = useUser((state) => state.user)!;
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);

  const editModal = useLazyModal(`carcasse-edit-${carcasse.zacharie_carcasse_id}`);
  const confirmDeleteModal = useLazyModal(`carcasse-delete-${carcasse.zacharie_carcasse_id}`);

  if (
    isCarcassePriseEnChargeEnAval(carcasse) ||
    carcasse.svi_automatic_closed_at ||
    carcasse.svi_closed_at ||
    carcasse.intermediaire_closed_at
  ) {
    return <CardCarcasse carcasse={carcasse} />;
  }

  const doDelete = () => {
    const nextPartialCarcasse: Partial<Carcasse> = {
      deleted_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
    track('carcasse', 'supprimer');
    addLog({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: carcasse.fei_numero,
      action: 'examinateur-carcasse-delete',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: null,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData('examinateur-carcasse-delete');
  };

  const handleDelete = () => {
    doDelete();
    confirmDeleteModal.close();
  };

  const handleTrashDelete = () => {
    if (window.confirm('Voulez-vous supprimer cette carcasse ? Cette opération est irréversible')) {
      doDelete();
    }
  };

  if (!canEditAsExaminateurInitial) {
    return (
      <CardCarcasse
        carcasse={carcasse}
        onDelete={canEditAsPremierDetenteur ? handleTrashDelete : undefined}
      />
    );
  }
  return (
    <>
      <CardCarcasse
        carcasse={carcasse}
        onEdit={() => editModal.open()}
        onClick={() => editModal.open()}
      />
      {editModal.isMounted && (
        <LazyModal
          modal={editModal.modal}
          size="large"
          title={`${carcasse.espece || 'Carcasse'} — N° ${carcasse.numero_bracelet}`}
          buttons={[
            {
              children: 'Supprimer',
              priority: 'tertiary no outline',
              iconId: 'fr-icon-delete-bin-line',
              className: 'text-error-main-525',
              doClosesModal: false,
              onClick: () => {
                editModal.close();
                confirmDeleteModal.open();
              },
            },
            { children: 'Terminer', doClosesModal: true },
          ]}
        >
          {(isOpen) => isOpen && <CarcasseExamenInitialForm carcasse={carcasse} />}
        </LazyModal>
      )}

      {confirmDeleteModal.isMounted && (
        <LazyModal
          modal={confirmDeleteModal.modal}
          title="Supprimer la carcasse"
          buttons={[
            { children: 'Annuler', priority: 'secondary', doClosesModal: true },
            {
              children: 'Supprimer',
              priority: 'tertiary',
              iconId: 'fr-icon-delete-bin-line',
              className: 'bg-error-main-525 text-white',
              doClosesModal: false,
              onClick: handleDelete,
            },
          ]}
        >
          {() => (
            <p className="mb-0">
              Voulez-vous supprimer la carcasse <strong>N° {carcasse.numero_bracelet}</strong>
              {carcasse.espece ? ` (${carcasse.espece})` : ''}&nbsp;? Cette opération est irréversible.
            </p>
          )}
        </LazyModal>
      )}
    </>
  );
});

function AddCarcasseCard({ id, onClick }: { id: string; onClick: () => void }) {
  return (
    <button
      type="button"
      id={id}
      data-matomo="carcasse-ouvrir-ajout"
      onClick={onClick}
      className="hover:border-action-high-blue-france flex min-h-24 basis-full flex-col items-center justify-center gap-3 border border-dashed border-gray-300 bg-white p-4 text-left transition-colors hover:bg-blue-50"
    >
      <span className="text-action-high-blue-france flex items-center gap-2 text-base font-medium">
        <span
          className="fr-icon-add-line"
          aria-hidden="true"
        />
        Ajouter une carcasse
      </span>
    </button>
  );
}
