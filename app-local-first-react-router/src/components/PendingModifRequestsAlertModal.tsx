import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { CarcasseModificationRequestStatus, CarcasseModificationRequestType } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';

const modal = createModal({
  isOpenedByDefault: false,
  id: 'pending-modif-requests-alert',
});

// ----------------------------------------------------------------------------
// PendingModifRequestsAlertModal
// S'ouvre automatiquement au montage si l'utilisateur courant est l'examinateur
// initial d'au moins une carcasse avec une demande de modification en cours.
// La demande est indicative : elle ne bloque personne, on informe seulement.
// Utilisé sur la page d'accueil chasseur (/app/chasseur) — apparaît à chaque
// visite de cette URL tant qu'il reste des demandes à traiter.
// ----------------------------------------------------------------------------
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

  // Strictly match /app/chasseur — the user wanted the modal to appear only on that root URL.
  // The trailing slash is tolerated to handle browser-normalised paths.
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

  // Open whenever the user lands on /app/chasseur and has pending demandes. We track an
  // "already opened for this visit" ref so:
  //   - the modal opens as soon as data finishes loading (count may be 0 at mount time, become > 0
  //     once loadFeis() resolves — depending on `count` here is what makes the modal show up)
  //   - dismissing it via "Plus tard" doesn't re-open it on every store change
  //   - leaving /app/chasseur resets the ref so the next visit re-opens
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
