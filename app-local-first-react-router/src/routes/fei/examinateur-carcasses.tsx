import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { Carcasse, UserRoles } from '@prisma/client';
import { useMemo } from 'react';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams, useNavigate } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { updateCarcasse } from '@app/zustand/actions/update-carcasse';
import { addLog } from '@app/zustand/actions/add-log';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import CardCarcasse from '@app/components/CardCarcasse';

export default function CarcassesExaminateur({
  canEdit,
  canEditAsPremierDetenteur,
}: {
  canEdit: boolean;
  canEditAsPremierDetenteur: boolean;
}) {
  // canEdit = true;
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const carcasses = useCarcassesForFei(params.fei_numero);

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  return (
    <>
      <div
        className={[
          'mb-2 transition-all duration-1000',
          !canEdit ? 'max-h-0 overflow-hidden' : 'max-h-[300vh]',
        ].join(' ')}
      >
        <NouvelleCarcasse key={fei.commune_mise_a_mort} />
      </div>
      {canEdit && carcasses.length > 0 && (
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
