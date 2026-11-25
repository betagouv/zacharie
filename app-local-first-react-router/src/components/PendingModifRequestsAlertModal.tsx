import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createModal } from '@app/components/Modal';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { CarcasseModificationRequestStatus, CarcasseModificationRequestType } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';

const modal = createModal({
  isOpenedByDefault: false,
  id: 'pending-modif-requests-alert',
});

export default function PendingModifRequestsAlertModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUser((state) => state.user);
  const modifRequestsByCarcasseId = useZustandStore((state) => state.modifRequestsByCarcasseId);
  const carcasses = useZustandStore((state) => state.carcasses);

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const isChasseurIndex = location.pathname === '/app/chasseur' || location.pathname === '/app/chasseur/';

  const pendingForMe = useMemo(() => {
    if (!user) return [];
    return Object.values(modifRequestsByCarcasseId)
      .flat()
      .filter((r) => {
        if (r.status !== CarcasseModificationRequestStatus.PENDING || r.deleted_at) return false;
        const c = carcasses[r.zacharie_carcasse_id];
        return c?.examinateur_initial_user_id === user.id;
      });
  }, [modifRequestsByCarcasseId, carcasses, user]);

  const count = pendingForMe.length;
  const renameCount = pendingForMe.filter(
    (r) => r.type === CarcasseModificationRequestType.BRACELET_RENAME
  ).length;
  const newCarcasseCount = count - renameCount;

  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasMounted) return;
    if (!isChasseurIndex) {
      hasOpenedRef.current = false;
      return;
    }
    if (count > 0 && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      modal.open();
    }
  }, [isChasseurIndex, count, hasMounted]);

  return (
    <modal.Component title="Modifications signalées sur vos carcasses">
      <div>
        {renameCount > 0 && (
          <p className="mb-3">
            {renameCount > 1
              ? `Le numéro de marquage de ${renameCount} carcasses a été modifié.`
              : "Le numéro de marquage d'une carcasse a été modifié."}
          </p>
        )}
        {newCarcasseCount > 0 && (
          <p className="mb-3">
            {newCarcasseCount > 1
              ? `${newCarcasseCount} carcasses ont été ajoutées à vos fiches et attendent la signature de votre examen initial.`
              : "Une carcasse a été ajoutée à l'une de vos fiches et attend la signature de votre examen initial."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            priority="primary"
            onClick={() => {
              modal.close();
              navigate('/app/chasseur/demandes-de-modification');
            }}
            type="button"
          >
            {count > 1 ? 'Voir les modifications' : 'Voir la modification'}
          </Button>
          <Button
            priority="secondary"
            onClick={() => modal.close()}
            type="button"
          >
            Plus tard
          </Button>
        </div>
      </div>
    </modal.Component>
  );
}
