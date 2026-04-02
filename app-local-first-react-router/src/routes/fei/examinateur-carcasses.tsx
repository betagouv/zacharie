import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { Carcasse, UserRoles } from '@prisma/client';
import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams, useNavigate } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import CardCarcasse from '@app/components/CardCarcasse';

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
  const fei = feis[params.fei_numero!];
  const carcasses = useMyCarcassesForFei(params.fei_numero);
  const [showForm, setShowForm] = useState(!allCarcassesConfirmed);

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  const hasCarcasses = carcasses.length > 0;
  const lastEspece = hasCarcasses ? carcasses[carcasses.length - 1].espece : null;

  return (
    <>
      {(!hasCarcasses || (showForm && !allCarcassesConfirmed)) && canEdit && (
        <div className="mb-2">
          <NouvelleCarcasse
            key={`${fei.commune_mise_a_mort}-${lastEspece}`}
            defaultEspece={lastEspece ?? undefined}
            onCarcasseAdded={() => setShowForm(false)}
          />
        </div>
      )}
      {canEdit && hasCarcasses && (
        <p className="my-4 ml-4 text-sm text-gray-500">
          Carcasses enregistrées sur cette fiche&nbsp;:
          {countCarcassesByEspece.map((line) => (
            <span className="ml-4 block" key={line}>
              {line}
            </span>
          ))}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {carcasses.map((carcasse) => {
          return (
            <CarcasseExaminateur
              key={carcasse.numero_bracelet}
              carcasse={carcasse}
              canEditAsExaminateurInitial={canEdit}
              canEditAsPremierDetenteur={canEditAsPremierDetenteur}
            />
          );
        })}
      </div>
      {canEdit && hasCarcasses && !allCarcassesConfirmed && !showForm && (
        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            priority="secondary"
            // className="w-full"
            iconId="fr-icon-add-line"
            onClick={() => setShowForm(true)}
          >
            Ajouter une autre carcasse
          </Button>
          <Button
            type="button"
            priority="primary"
            // className="w-full"
            onClick={() => {
              onAllCarcassesConfirmed();
            }}
          >
            J'ai renseigné toutes mes carcasses
          </Button>
        </div>
      )}
      {canEdit && hasCarcasses && allCarcassesConfirmed && (
        <Button
          type="button"
          priority="tertiary"
          className="mt-4 w-full"
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
  carcasse: Carcasse;
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
            navigate(`/app/tableau-de-bord/carcasse/${fei.numero}/${carcasse.zacharie_carcasse_id}`);
          }
      }
      onClick={
        !canEditAsExaminateurInitial
          ? undefined
          : () => {
            navigate(`/app/tableau-de-bord/carcasse/${fei.numero}/${carcasse.zacharie_carcasse_id}`);
          }
      }
      onDelete={
        !canEditAsExaminateurInitial && !canEditAsPremierDetenteur
          ? undefined
          : () => {
            if (window.confirm('Voulez-vous supprimer cette carcasse ? Cette opération est irréversible')) {
              const nextPartialCarcasse: Partial<Carcasse> = {
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
