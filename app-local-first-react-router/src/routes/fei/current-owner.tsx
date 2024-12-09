import { useMemo } from 'react';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { getUserRoleLabelPrefixed } from '@app/utils/get-user-roles-label';
import { UserRoles } from '@prisma/client';
import DeleteButtonAndConfirmModal from '@app/components/DeleteButtonAndConfirmModal';
import { useNavigate, useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function CurrentOwner() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFei = state.updateFei;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
  const currentOwnerUser = fei.fei_current_owner_user_id ? state.users[fei.fei_current_owner_user_id] : null;
  const currentOwnerEntity = fei.fei_current_owner_entity_id
    ? state.entities[fei.fei_current_owner_entity_id]
    : null;

  const navigate = useNavigate();

  const canDeleteFei = useMemo(() => {
    if (user.roles.includes(UserRoles.ADMIN)) {
      return true;
    }
    if (!user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      return false;
    }
    return fei.fei_current_owner_user_id === user.id;
  }, [user.roles, fei.fei_current_owner_user_id, user.id]);

  const currentOwnerRole = useMemo(() => {
    if (user.roles.includes(UserRoles.ADMIN)) {
      return UserRoles.ADMIN;
    }
    if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      return UserRoles.EXAMINATEUR_INITIAL;
    }
    return fei.fei_current_owner_role;
  }, [user.roles, fei.fei_current_owner_role]);

  if (fei.svi_signed_at) {
    return (
      <div className="bg-alt-blue-france pb-8">
        <div className="bg-white">
          <Alert
            severity="success"
            description="Merci à l'ensemble des acteurs pour la prise en charge de cette fiche."
            title="Fiche clôturée"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-alt-blue-france pb-8">
      <Highlight
        className="m-0"
        classes={{
          root: 'fr-highlight--green-emeraude',
        }}
      >
        Cette fiche est présentement sous la responsabilité{' '}
        <b>{getUserRoleLabelPrefixed(fei.fei_current_owner_role as UserRoles)}</b>.<br />
        {currentOwnerEntity?.nom_d_usage && (
          <>
            <b>{currentOwnerEntity.nom_d_usage}</b> - {currentOwnerEntity.code_postal}{' '}
            {currentOwnerEntity.ville}
            <br />
          </>
        )}
        {currentOwnerUser?.prenom && (
          <>
            <b>
              {currentOwnerUser.prenom} {currentOwnerUser.nom_de_famille}
            </b>
            {' - '}
            {currentOwnerUser.code_postal} {currentOwnerUser.ville}
            <br />
          </>
        )}
      </Highlight>
      {canDeleteFei && (
        <div className="mt-2 flex justify-start border-l-4 border-l-red-500 pl-8">
          <DeleteButtonAndConfirmModal
            title="Supprimer la fiche"
            buttonText="Supprimer la fiche"
            textToConfirm="SUPPRIMER LA FICHE"
            onConfirm={() => {
              const nextFei = { deleted_at: dayjs().toDate() };
              updateFei(fei.numero, nextFei);
              addLog({
                user_id: user.id,
                user_role: currentOwnerRole!,
                fei_numero: fei.numero,
                action: 'current-owner-delete',
                entity_id: currentOwnerEntity?.id || null,
                zacharie_carcasse_id: null,
                fei_intermediaire_id: null,
                carcasse_intermediaire_id: null,
                history: createHistoryInput(fei, nextFei),
              });
              setTimeout(() => {
                navigate(-1);
              }, 1000);
            }}
          />
        </div>
      )}
    </div>
  );
}
