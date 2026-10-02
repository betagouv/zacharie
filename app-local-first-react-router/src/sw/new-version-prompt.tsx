import { useState } from 'react';
import { toast } from 'react-toastify';
import useZustandStore from '@app/zustand/store';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { syncData } from '@app/utils/sync-data';

export function showNewVersionPrompt() {
  toast.info(<NewVersionPrompt />, {
    toastId: 'nouvelle-version',
    autoClose: false,
    closeOnClick: false,
  });
}

function NewVersionPrompt() {
  const isOnline = useIsOnline();
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  const showUnsyncedWarning = !dataIsSynced && (!isOnline || syncFailed);

  async function handleReload() {
    if (!dataIsSynced && isOnline && !syncFailed) {
      setIsSyncing(true);
      await syncData('nouvelle-version');
      setIsSyncing(false);
      if (!useZustandStore.getState().dataIsSynced) {
        setSyncFailed(true);
        return;
      }
    }
    // reload() recharge la page sur place : dans la WebView Expo, l'URL reste celle de l'app et
    // n'est donc pas ouverte dans Safari, contrairement à une affectation de window.location.href.
    window.location.reload();
  }

  return (
    <div>
      <p className="m-0">Une nouvelle version de Zacharie est disponible.</p>
      {showUnsyncedWarning && (
        <p className="mt-2 mb-0 text-sm">
          Des données ne sont pas encore synchronisées. Elles restent enregistrées sur cet appareil et seront
          envoyées dès le retour de la connexion.
        </p>
      )}
      <button
        type="button"
        className="fr-btn fr-btn--sm mt-2"
        onClick={handleReload}
        disabled={isSyncing}
      >
        {isSyncing ? 'Synchronisation en cours…' : showUnsyncedWarning ? 'Recharger quand même' : 'Recharger'}
      </button>
    </div>
  );
}
