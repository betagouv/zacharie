import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { CarcasseModificationRequestStatus } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';

// ----------------------------------------------------------------------------
// PendingModifRequestsAlertModal
// S'ouvre automatiquement au montage si l'utilisateur courant est l'examinateur
// initial d'au moins une carcasse avec une demande de modification en attente.
// Utilisé sur la page d'accueil chasseur (/app/chasseur) — apparaît à chaque
// visite de cette URL tant qu'il reste des demandes à traiter.
// ----------------------------------------------------------------------------

export default function PendingModifRequestsAlertModal() {
  const location = useLocation();
  const user = useUser((state) => state.user);
  const requestsById = useZustandStore((state) => state.carcasseModifPendingRequestsIds);
  const carcasses = useZustandStore((state) => state.carcasses);

  /* FIXME: hack to fix the bug "TypeError: Cannot read properties of null (reading 'modal')" */
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    if (hasMounted) return;
    setHasMounted(true);
  }, []);
  /* END FIXME */

  // Strictly match /app/chasseur — the user wanted the modal to appear only on that root URL.
  // The trailing slash is tolerated to handle browser-normalised paths.
  const isChasseurIndex = location.pathname === '/app/chasseur' || location.pathname === '/app/chasseur/';
  const pendingForMe = useMemo(() => {
    if (!user) return [];
    console.log('requestsById', requestsById);
    return Object.values(requestsById).filter((r) => {
      if (r.status !== CarcasseModificationRequestStatus.PENDING || r.deleted_at) return false;
      const c = carcasses[r.zacharie_carcasse_id];
      return c?.examinateur_initial_user_id === user.id;
    });
  }, [requestsById, carcasses, user]);

  const count = pendingForMe.length;

  console.log('count', count);
  console.log('isChasseurIndex', isChasseurIndex);
  if (count > 0 && isChasseurIndex) {
    return <PendingModifRequestsAlertModalRendered key={count} />;
  }
  return null;
}

function PendingModifRequestsAlertModalRendered() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUser((state) => state.user);
  const requestsById = useZustandStore((state) => state.carcasseModifPendingRequestsIds);
  const carcasses = useZustandStore((state) => state.carcasses);

  const modal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: 'pending-modif-requests-alert',
    })
  ).current;

  /* FIXME: hack to fix the bug "TypeError: Cannot read properties of null (reading 'modal')" */
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    if (hasMounted) return;
    setHasMounted(true);
  }, []);
  /* END FIXME */

  // Strictly match /app/chasseur — the user wanted the modal to appear only on that root URL.
  // The trailing slash is tolerated to handle browser-normalised paths.
  const isChasseurIndex = location.pathname === '/app/chasseur' || location.pathname === '/app/chasseur/';

  const pendingForMe = useMemo(() => {
    if (!user) return [];
    return Object.values(requestsById).filter((r) => {
      if (r.status !== CarcasseModificationRequestStatus.PENDING || r.deleted_at) return false;
      const c = carcasses[r.zacharie_carcasse_id];
      return c?.examinateur_initial_user_id === user.id;
    });
  }, [requestsById, carcasses, user]);

  const count = pendingForMe.length;

  // Open whenever the user lands on /app/chasseur and has pending demandes. We track an
  // "already opened for this visit" ref so:
  //   - the modal opens as soon as data finishes loading (count may be 0 at mount time, become > 0
  //     once loadFeis() resolves — depending on `count` here is what makes the modal show up)
  //   - dismissing it via "Plus tard" doesn't re-open it on every store change
  //   - leaving /app/chasseur resets the ref so the next visit re-opens
  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasMounted) {
      return;
    }
    console.log('modal', modal);
    if (!isChasseurIndex) {
      hasOpenedRef.current = false;
      return;
    }
    if (count > 0 && !hasOpenedRef.current) {
      if (modal?.open) {
        modal.open();
        hasOpenedRef.current = true;
      }
    }
  }, [isChasseurIndex, count, hasMounted]);

  return (
    <modal.Component title="Demandes de modification en attente">
      <div>
        <p className="mb-3">
          Vous avez <strong>{count}</strong>{' '}
          {count > 1 ? 'demandes de modification en attente' : 'demande de modification en attente'} sur{' '}
          {count > 1 ? 'des carcasses' : 'une carcasse'} dont vous êtes l'examinateur initial, il vous faut
          donc approuver ou refuser {count > 1 ? 'ces modifications' : 'cette modification'}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            priority="primary"
            onClick={() => {
              modal.close();
              navigate('/app/chasseur/demandes-de-modification');
            }}
            type="button"
          >
            Voir les demandes
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
