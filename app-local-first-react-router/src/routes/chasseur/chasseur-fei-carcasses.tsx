import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { UserRoles } from '@prisma/client';
import { useMemo, useRef } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import Alert from '@codegouvfr/react-dsfr/Alert';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import CarcasseDetailsModal from '@app/components/CarcasseDetailsModal';
import CarcasseExamenInitialForm from '@app/components/CarcasseExamenInitialForm';
import { formatCarcasseLotCount, formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import CardCarcasse from '@app/components/CardCarcasse';
import type { Carcasse } from '@prisma/client';
import { CarcasseWithModificationRequests } from '@api/src/types/carcasse';
import { lookupAnomalie } from '@app/utils/anomalies-referentiel-data';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';

export default function CarcassesExaminateur({
  canEdit,
  canEditAsPremierDetenteur,
  allCarcassesConfirmed,
  onAllCarcassesConfirmed,
  onAddMoreCarcasses,
}: {
  canEdit: boolean;
  canEditAsPremierDetenteur: boolean;
  allCarcassesConfirmed: boolean;
  onAllCarcassesConfirmed: () => void;
  onAddMoreCarcasses: () => void;
}) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei_numero = params.fei_numero!;
  const fei = feis[fei_numero];
  const entities = useZustandStore((state) => state.entities);
  const carcasses = useMyCarcassesForFei(params.fei_numero);

  const hasCarcasses = carcasses.length > 0;
  const lastEspece = hasCarcasses ? carcasses[carcasses.length - 1].espece : null;

  const { restantes, dejaEnvoyeesParDestinataire } = useMemo(() => {
    const restantesList: Carcasse[] = [];
    const grouped: Record<string, Carcasse[]> = {};
    for (const c of carcasses) {
      // Côté chasseur, on ne regroupe que par le destinataire choisi par le premier détenteur.
      // Le reste de la chaîne aval (ETG suivant, SVI…) ne le concerne pas.
      const destinataireId = c.premier_detenteur_prochain_detenteur_id_cache;
      if (!destinataireId) {
        restantesList.push(c);
        continue;
      }
      if (!grouped[destinataireId]) grouped[destinataireId] = [];
      grouped[destinataireId].push(c);
    }
    return { restantes: restantesList, dejaEnvoyeesParDestinataire: grouped };
  }, [carcasses]);

  const hasGroups = Object.keys(dejaEnvoyeesParDestinataire).length > 0;

  const confirmModal = useRef(
    createModal({ id: `carcasse-confirm-${fei.numero}`, isOpenedByDefault: false })
  ).current;

  const addModal = useRef(
    createModal({ id: `carcasse-add-${fei.numero}`, isOpenedByDefault: false })
  ).current;
  const isAddModalOpen = useIsModalOpen(addModal);

  // Ajouter une carcasse « invalide » la confirmation (les heures doivent être ressaisies).
  const openAddModal = () => {
    if (allCarcassesConfirmed) onAddMoreCarcasses();
    addModal.open();
  };

  // Synthèse des anomalies renseignées sur l'ensemble des carcasses de la fiche,
  // pour la modale de confirmation. `total` = nombre total renseigné ;
  // `avecMessage` = anomalies distinctes porteuses d'un avertissement (dédupliquées).
  const { total: anomaliesTotal, avecMessage: anomaliesAvecMessage } = useMemo(() => {
    let total = 0;
    const seen = new Set<string>();
    const avecMessage: Array<{ intitule: string; message: string }> = [];
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
          avecMessage.push({ intitule: found.item.intitule, message: found.item.message });
        }
      }
    }
    return { total, avecMessage };
  }, [carcasses]);

  const renderCarcasseCard = (carcasse: CarcasseWithModificationRequests) => (
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
          {restantes.length > 0 && (
            <div>
              <p className="mt-0 mb-2 text-sm text-gray-500">
                À attribuer ({formatCarcasseLotCount(restantes)})
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {restantes.map((carcasse: Carcasse) => (
                  <CarcasseExaminateur
                    key={carcasse.numero_bracelet}
                    carcasse={carcasse}
                    canEditAsExaminateurInitial={canEdit}
                    canEditAsPremierDetenteur={canEditAsPremierDetenteur}
                  />
                ))}
              </div>
            </div>
          )}
          {Object.entries(dejaEnvoyeesParDestinataire).map(([entityId, group]) => (
            <div key={entityId}>
              <p className="mt-0 mb-2 text-sm text-gray-500">
                Envoyée à {entities[entityId]?.nom_d_usage ?? 'destinataire inconnu'} (
                {formatCarcasseLotCount(group)})
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {group.map((carcasse: Carcasse) => (
                  <CarcasseExaminateur
                    key={carcasse.numero_bracelet}
                    carcasse={carcasse}
                    canEditAsExaminateurInitial={canEdit}
                    canEditAsPremierDetenteur={canEditAsPremierDetenteur}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {carcasses.map((carcasse: Carcasse) => (
            <CarcasseExaminateur
              key={carcasse.numero_bracelet}
              carcasse={carcasse}
              canEditAsExaminateurInitial={canEdit}
              canEditAsPremierDetenteur={canEditAsPremierDetenteur}
            />
          ))}
        </div>
      )}
      {canEdit && (
        <AddCarcasseCard
          id="add-more-carcasses-button"
          className={hasCarcasses ? 'mt-2' : ''}
          onClick={openAddModal}
        />
      )}
      {canEdit && hasCarcasses && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!allCarcassesConfirmed && (
            <Button
              type="button"
              priority="primary"
              onClick={() => confirmModal.open()}
            >
              Continuer
            </Button>
          )}
        </div>
      )}
      {canEdit && (
        <addModal.Component
          size="large"
          title="Ajouter une carcasse"
          buttons={[{ children: 'Terminer', doClosesModal: true }]}
        >
          {isAddModalOpen && (
            <NouvelleCarcasse
              key={`${fei.commune_mise_a_mort}-${lastEspece}`}
              defaultEspece={lastEspece ?? undefined}
              onCarcasseAdded={() => addModal.close()}
            />
          )}
        </addModal.Component>
      )}
      {canEdit && hasCarcasses && (
        <confirmModal.Component
          title={anomaliesTotal > 0 ? 'Anomalies renseignées' : 'Aucune anomalie renseignée'}
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
          {anomaliesTotal > 0 ? (
            <div className="flex flex-col gap-4">
              <p className="mb-0">
                Vous avez renseigné {anomaliesTotal} anomalie{anomaliesTotal > 1 ? 's' : ''}.
              </p>
              {anomaliesAvecMessage.map(({ intitule, message }) => (
                <Alert
                  key={intitule}
                  severity="warning"
                  title={intitule}
                  description={message}
                />
              ))}
            </div>
          ) : (
            <Alert
              severity="info"
              small
              description="Vous n'avez pas renseigné d'anomalie. Cela implique que l'examen initial des carcasses n'a pas détecté d'anomalies sur les carcasses, les abats ou le comportement de l'animal."
            />
          )}
        </confirmModal.Component>
      )}
    </>
  );
}

export function CarcasseExaminateur({
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

  const editModal = useRef(
    createModal({ id: `carcasse-edit-${carcasse.zacharie_carcasse_id}`, isOpenedByDefault: false })
  ).current;
  const isEditModalOpen = useIsModalOpen(editModal);

  if (!canEditAsExaminateurInitial && !canEditAsPremierDetenteur) {
    return <CardCarcasse carcasse={carcasse} />;
  }
  return (
    <>
      <CardCarcasse
        carcasse={carcasse}
        onEdit={!canEditAsExaminateurInitial ? undefined : () => editModal.open()}
        onClick={!canEditAsExaminateurInitial ? undefined : () => editModal.open()}
        onDelete={
          !canEditAsExaminateurInitial && !canEditAsPremierDetenteur
            ? undefined
            : () => {
              if (
                window.confirm('Voulez-vous supprimer cette carcasse ? Cette opération est irréversible')
              ) {
                const nextPartialCarcasse: Partial<CarcasseWithModificationRequests> = {
                  deleted_at: dayjs().toDate(),
                };
                updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
                addLog({
                  user_id: user.id,
                  user_role: UserRoles.CHASSEUR,
                  fei_numero: fei.numero,
                  action: 'examinateur-carcasse-delete',
                  history: createHistoryInput(carcasse, nextPartialCarcasse),
                  entity_id: null,
                  zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                  intermediaire_id: null,
                  carcasse_intermediaire_id: null,
                });
              }
            }
        }
      />
      <editModal.Component
        size="large"
        title={`${carcasse.espece || 'Carcasse'} — N° ${carcasse.numero_bracelet}`}
        buttons={[{ children: 'Terminer', doClosesModal: true }]}
      >
        {isEditModalOpen && <CarcasseExamenInitialForm carcasse={carcasse} />}
      </editModal.Component>
    </>
  );
}

// Carte « fantôme » pour ajouter une carcasse : se fond dans la liste des cartes
// (bordure pointillée) plutôt qu'un bouton concurrent.
function AddCarcasseCard({
  id,
  onClick,
  className,
}: {
  id: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className={[
        'flex w-full items-center justify-center gap-2 rounded border border-dashed border-gray-300 p-4 font-medium text-[#000091] transition-colors hover:border-[#000091] hover:bg-[#f6f6f6]',
        className || '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className="fr-icon-add-line"
        aria-hidden
      />
      Ajouter une carcasse
    </button>
  );
}
