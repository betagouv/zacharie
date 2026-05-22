import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { FeiOwnerRole, UserRoles } from '@prisma/client';
import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { formatCarcasseLotCount, formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams, useNavigate } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import CardCarcasse from '@app/components/CardCarcasse';
import { CarcasseWithModificationRequests } from '@api/src/types/carcasse';

export default function CarcassesExaminateur({
  canEdit,
  canEditAsPremierDetenteur,
  allCarcassesConfirmed,
  allCarcassesPastPremierDetenteur,
  onAllCarcassesConfirmed,
  onAddMoreCarcasses,
}: {
  canEdit: boolean;
  canEditAsPremierDetenteur: boolean;
  allCarcassesConfirmed: boolean;
  allCarcassesPastPremierDetenteur: boolean;
  onAllCarcassesConfirmed: () => void;
  onAddMoreCarcasses: () => void;
}) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const entities = useZustandStore((state) => state.entities);
  const carcasses = useMyCarcassesForFei(params.fei_numero);
  const [showForm, setShowForm] = useState(!allCarcassesConfirmed);

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  const hasCarcasses = carcasses.length > 0;
  const lastEspece = hasCarcasses ? carcasses[carcasses.length - 1].espece : null;
  const canAddCarcasse = useMemo(() => {
    if (!allCarcassesPastPremierDetenteur) return true;
    return false;
  }, [allCarcassesPastPremierDetenteur]);

  const { restantes, dejaEnvoyeesParDestinataire } = useMemo(() => {
    const restantesList: CarcasseWithModificationRequests[] = [];
    const grouped: Record<string, CarcasseWithModificationRequests[]> = {};
    for (const c of carcasses) {
      const isDispatched =
        c.next_owner_entity_id != null ||
        (c.current_owner_role != null &&
          c.current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
          c.current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL);
      if (!isDispatched) {
        restantesList.push(c);
        continue;
      }
      const key = c.next_owner_entity_id || c.current_owner_entity_id || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    }
    return { restantes: restantesList, dejaEnvoyeesParDestinataire: grouped };
  }, [carcasses]);

  const hasGroups = Object.keys(dejaEnvoyeesParDestinataire).length > 0;

  const renderCarcasseCard = (carcasse: CarcasseWithModificationRequests) => (
    <CarcasseExaminateur
      key={carcasse.numero_bracelet}
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
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{restantes.map(renderCarcasseCard)}</div>
            </div>
          )}
          {Object.entries(dejaEnvoyeesParDestinataire).map(([entityId, group]) => (
            <div key={entityId}>
              <p className="mt-0 mb-2 text-sm text-gray-500">
                Vers {entities[entityId]?.nom_d_usage ?? 'destinataire inconnu'} (
                {formatCarcasseLotCount(group)})
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{group.map(renderCarcasseCard)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{carcasses.map(renderCarcasseCard)}</div>
      )}
      {(!hasCarcasses || (showForm && !allCarcassesConfirmed)) && canEdit && (
        <div className="my-2">
          <NouvelleCarcasse
            key={`${fei.commune_mise_a_mort}-${lastEspece}`}
            defaultEspece={lastEspece ?? undefined}
            onCarcasseAdded={() => setShowForm(false)}
          />
        </div>
      )}

      {canAddCarcasse && canEdit && hasCarcasses && !allCarcassesConfirmed && !showForm && (
        <div className="mt-4">
          <Button
            type="button"
            id="add-more-carcasses-button"
            priority="secondary"
            iconId="fr-icon-add-line"
            onClick={() => {
              onAddMoreCarcasses();
              setShowForm(true);
            }}
          >
            Ajouter une autre carcasse
          </Button>
        </div>
      )}
      {canEdit && hasCarcasses && (
        <p className="my-4 ml-4 text-sm text-gray-500">
          Carcasses enregistrées sur cette fiche&nbsp;:
          {countCarcassesByEspece.map((line) => (
            <span
              className="ml-4 block"
              key={line}
            >
              {line}
            </span>
          ))}
        </p>
      )}
      {canEdit && hasCarcasses && !allCarcassesConfirmed && (
        <div className="mt-4">
          <Button
            type="button"
            priority="primary"
            onClick={() => {
              onAllCarcassesConfirmed();
            }}
          >
            Continuer
          </Button>
        </div>
      )}
      {canAddCarcasse && canEdit && hasCarcasses && allCarcassesConfirmed && (
        <Button
          type="button"
          id="add-more-carcasses"
          priority="secondary"
          className="mt-4"
          iconId="fr-icon-add-line"
          onClick={() => {
            onAddMoreCarcasses();
            setShowForm(true);
          }}
        >
          Ajouter une autre carcasse
        </Button>
      )}
    </>
  );
}

export function CarcasseExaminateur({
  carcasse,
  canEditAsPremierDetenteur,
  canEditAsExaminateurInitial,
}: {
  carcasse: CarcasseWithModificationRequests;
  canEditAsPremierDetenteur?: boolean;
  canEditAsExaminateurInitial?: boolean;
}) {
  // canEdit = true;
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const navigate = useNavigate();

  if (!canEditAsExaminateurInitial && !canEditAsPremierDetenteur) {
    return <CardCarcasse carcasse={carcasse} />;
  }
  return (
    <CardCarcasse
      carcasse={carcasse}
      onEdit={
        !canEditAsExaminateurInitial
          ? undefined
          : () => {
              navigate(`/app/chasseur/carcasse/${fei.numero}/${carcasse.zacharie_carcasse_id}`);
            }
      }
      onClick={
        !canEditAsExaminateurInitial
          ? undefined
          : () => {
              navigate(`/app/chasseur/carcasse/${fei.numero}/${carcasse.zacharie_carcasse_id}`);
            }
      }
      onDelete={
        !canEditAsExaminateurInitial && !canEditAsPremierDetenteur
          ? undefined
          : () => {
              if (window.confirm('Voulez-vous supprimer cette carcasse ? Cette opération est irréversible')) {
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
  );
}
