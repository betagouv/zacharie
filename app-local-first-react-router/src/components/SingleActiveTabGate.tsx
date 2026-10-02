import { useActiveTab, takeOverActiveTab } from '@app/utils/single-active-tab';

export default function SingleActiveTabGate({ children }: { children: React.ReactNode }) {
  const status = useActiveTab((state) => state.status);
  if (status === 'active') return children;
  if (status === 'pending') return null;
  return (
    <main
      role="main"
      id="content"
    >
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-8">
            <h1 className="fr-h3">Zacharie est déjà ouvert dans un autre onglet</h1>
            <p className="fr-mb-5w">Fermez cet onglet ou utilisez l'autre.</p>
            <button
              type="button"
              className="fr-btn"
              onClick={takeOverActiveTab}
            >
              Utiliser cet onglet
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
