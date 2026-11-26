import { useEffect, useRef } from 'react';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';

// État d'un enregistrement IPM : erreur de saisie (rien n'est enregistré), sinon enregistrement
// local fait, puis état de l'envoi au serveur lu dans le store (`is_synced`, `isOnline`, refus).
export function IpmSaveStatus({
  ipm,
  zacharieCarcasseId,
  missingFields,
  saveAttempts,
  saved,
}: {
  ipm: 'IPM1' | 'IPM2';
  zacharieCarcasseId: string;
  missingFields: string | null;
  // nombre de clics sur « Enregistrer » : 0 tant que l'utilisateur n'a pas essayé
  saveAttempts: number;
  saved: boolean;
}) {
  const carcasse = useZustandStore((state) => state.carcasses[zacharieCarcasseId]);
  const isOnline = useZustandStore((state) => state.isOnline);
  // un refus porte sur une version précise de la carcasse : on ne montre que celui de la version actuelle
  const rejection = useZustandStore((state) =>
    state.syncRejections.find(
      (r) =>
        r.kind === 'carcasse' &&
        r.id === zacharieCarcasseId &&
        r.updated_at === dayjs(carcasse?.updated_at).valueOf()
    )
  );
  const ref = useRef<HTMLDivElement>(null);

  const showMissingFields = saveAttempts > 0 && !!missingFields;
  // à chaque clic, on amène le message sous les yeux : le bouton est en bas d'un long formulaire
  useEffect(() => {
    if (saveAttempts > 0) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [saveAttempts]);

  let alert = null;
  if (showMissingFields) {
    alert = (
      <Alert
        severity="error"
        title={`${ipm} non enregistrée`}
        description={missingFields}
      />
    );
  } else if (saved && rejection) {
    alert = (
      <Alert
        severity="error"
        title={`${ipm} refusée par le serveur`}
        description={`Elle est enregistrée sur cet appareil mais n'a pas été envoyée : ${rejection.reason}`}
      />
    );
  } else if (saved && carcasse?.is_synced) {
    alert = (
      <Alert
        severity="success"
        title={`${ipm} enregistrée`}
        description="Elle a été envoyée au serveur."
      />
    );
  } else if (saved && !isOnline) {
    alert = (
      <Alert
        severity="info"
        title={`${ipm} enregistrée sur cet appareil`}
        description="Elle sera envoyée au retour du réseau."
      />
    );
  } else if (saved) {
    alert = (
      <Alert
        severity="info"
        title={`${ipm} enregistrée sur cet appareil`}
        description="Envoi au serveur en cours…"
      />
    );
  }

  return (
    <div
      ref={ref}
      className="mt-4"
    >
      {alert}
    </div>
  );
}
