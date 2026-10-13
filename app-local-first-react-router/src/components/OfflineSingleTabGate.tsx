import { useOfflineTabBlocked } from '@app/utils/offline-single-tab';

export default function OfflineSingleTabGate({ children }: { children: React.ReactNode }) {
  const blocked = useOfflineTabBlocked((state) => state.blocked);
  if (!blocked) return children;
  return (
    <main
      role="main"
      id="content"
    >
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-8">
            <h1 className="fr-h3">Hors ligne, Zacharie arrête de fonctionner sur plusieurs onglets</h1>
            <p>Vous ne pouvez en utiliser qu'un seul. Revenez à l'onglet que vous utilisiez.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
