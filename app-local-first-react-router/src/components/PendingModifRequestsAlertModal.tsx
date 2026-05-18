import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
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
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUser((state) => state.user);
  const requestsById = useZustandStore((state) => state.carcasseModifPendingRequestsIds);
  const carcasses = useZustandStore((state) => state.carcasses);

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

  const modal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: 'pending-modif-requests-alert',
    })
  ).current;
  const isOpen = useIsModalOpen(modal);

  // Open whenever the user lands on /app/chasseur and has pending demandes. Re-opens on every visit
  // (per request) — even after dismissal, navigating away and back re-triggers because the effect
  // depends on location.pathname.
  useEffect(() => {
    if (isChasseurIndex && count > 0) {
      modal.open();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChasseurIndex, location.pathname]);

  if (count === 0 || !isChasseurIndex) return null;

  return (
    <modal.Component title="Demandes de modification en attente">
      {isOpen && (
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
      )}
    </modal.Component>
  );
}
