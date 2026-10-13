import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';

// Prévient l'utilisateur que des modifications faites sur cet appareil ont été refusées par le
// serveur pendant la session : elles ne seront jamais enregistrées.
export default function SyncRejectionsNotice() {
  const syncRejections = useZustandStore((state) => state.syncRejections);
  if (syncRejections.length === 0) return null;

  const reasons = [...new Set(syncRejections.map((r) => r.reason))];
  const count = syncRejections.length;

  return (
    <div className="px-4 pt-4">
      <Alert
        severity="warning"
        small
        title={`${count} modification${count > 1 ? 's' : ''} refusée${count > 1 ? 's' : ''} par le serveur`}
        description={
          <>
            Ces modifications n'ont pas été enregistrées.
            <ul className="mt-2">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        }
      />
    </div>
  );
}
