import { useMemo } from 'react';
import { UserRoles } from '@prisma/client';
import ConfirmModal from '@app/components/ConfirmModal';
import { useNavigate, useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore, { syncData } from '@app/zustand/store';
import { updateFei } from '@app/zustand/actions/update-fei';
import { addLog } from '@app/zustand/actions/add-log';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function DeleteFei() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const fei = useZustandStore((state) => state.feis[params.fei_numero!]);
  const currentOwnerEntity = useZustandStore((state) =>
    fei.fei_current_owner_entity_id ? state.entities[fei.fei_current_owner_entity_id] : null,
  );

  const navigate = useNavigate();

  const canDeleteFei = useMemo(() => {
    if (user.roles.includes(UserRoles.ADMIN)) {
      return true;
    }
    const isExaminateurInitial = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
    if (!isExaminateurInitial) {
      return false;
    }
    return fei.fei_current_owner_user_id === user.id;
  }, [user.roles, user.numero_cfei, user.id, fei.fei_current_owner_user_id]);

  const currentOwnerRole: UserRoles | null = useMemo(() => {
    if (user.roles.includes(UserRoles.ADMIN)) {
      return UserRoles.ADMIN;
    }
    if (user.roles.includes(UserRoles.CHASSEUR)) {
      return UserRoles.CHASSEUR;
    }
    return fei.fei_current_owner_role as UserRoles;
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
          intermediaire_id: null,
          carcasse_intermediaire_id: null,
          history: createHistoryInput(fei, nextFei),
        });
        syncData('delete-fei');
        setTimeout(() => {
          navigate(-1);
        }, 1000);
      }}
    />
  );
}
