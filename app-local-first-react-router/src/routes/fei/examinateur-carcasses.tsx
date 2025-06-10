import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { Carcasse, UserRoles } from '@prisma/client';
import { useMemo } from 'react';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams, useNavigate } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
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
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const allCarcasses = useZustandStore((state) => state.carcasses);
  // console.log('fei', fei);
  const carcasses = (carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => allCarcasses[cId])
    .filter((c) => !c.deleted_at);

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
        <p className="mb-4 ml-4 text-sm text-gray-500">
          Déjà rentrés&nbsp;:
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
                updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                addLog({
                  user_id: user.id,
                  user_role: UserRoles.EXAMINATEUR_INITIAL,
                  fei_numero: fei.numero,
                  action: 'examinateur-carcasse-delete',
                  history: createHistoryInput(carcasse, nextPartialCarcasse),
                  entity_id: null,
                  zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                  fei_intermediaire_id: null,
                  carcasse_intermediaire_id: null,
                });
              }
            }
      }
    />
  );
}
