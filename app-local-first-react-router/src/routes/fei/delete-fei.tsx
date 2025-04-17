import { useMemo } from 'react';
import { UserRoles } from '@prisma/client';
import ConfirmModal from '@app/components/ConfirmModal';
import { useNavigate, useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function DeleteFei() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFei = state.updateFei;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
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

  if (!canDeleteFei) {
    return null;
  }

  return (
    <ConfirmModal
      title="Voulez-vous vraiment supprimer la fiche ?"
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
  );
}
