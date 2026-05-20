import { useEffect, useMemo, useState } from 'react';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { Tabs } from '@codegouvfr/react-dsfr/Tabs';
import { UserRoles } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import useCarcasseModal, { type CarcasseTab } from '@app/zustand/ui-modals';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { getCarcasseCardDisplay, type CardViewRole } from '@app/utils/get-carcasse-card-display';
import { getCarcasseCapabilities } from '@app/utils/carcasse-permissions';
import CarcasseModalHeader from './CarcasseModalHeader';
import TabIdentite from './tabs/TabIdentite';
import TabTracabilite from './tabs/TabTracabilite';
import TabIntermediaire from './tabs/TabIntermediaire';
import TabInspectionSVI from './tabs/TabInspectionSVI';

const carcasseModal = createModal({
  id: 'carcasse-modal-root',
  isOpenedByDefault: false,
});

export default function CarcasseModalRoot() {
  const carcasseId = useCarcasseModal((s) => s.carcasseId);
  const feiNumero = useCarcasseModal((s) => s.feiNumero);
  const initialTab = useCarcasseModal((s) => s.initialTab);
  const close = useCarcasseModal((s) => s.close);

  const isOpen = useIsModalOpen(carcasseModal);

  useEffect(() => {
    if (carcasseId && feiNumero && !isOpen) {
      carcasseModal.open();
    }
  }, [carcasseId, feiNumero, isOpen]);

  useEffect(() => {
    if (!isOpen && (carcasseId || feiNumero)) {
      close();
    }
  }, [isOpen, carcasseId, feiNumero, close]);

  const handleNavigateAway = () => {
    carcasseModal.close();
    close();
  };

  return (
    <carcasseModal.Component
      size="large"
      title=""
      concealingBackdrop
    >
      {isOpen && carcasseId && feiNumero && (
        <CarcasseModalContent
          carcasseId={carcasseId}
          feiNumero={feiNumero}
          initialTab={initialTab}
          onAfterNavigate={handleNavigateAway}
        />
      )}
    </carcasseModal.Component>
  );
}

function CarcasseModalContent({
  carcasseId,
  feiNumero,
  initialTab,
  onAfterNavigate,
}: {
  carcasseId: string;
  feiNumero: string;
  initialTab: CarcasseTab | null;
  onAfterNavigate: () => void;
}) {
  const carcasse = useZustandStore((s) => s.carcasses[carcasseId]);
  const fei = useZustandStore((s) => s.feis[feiNumero]);
  const entities = useZustandStore((s) => s.entities);
  const user = useUser((s) => s.user)!;
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasseId);

  const capabilities = useMemo(
    () => getCarcasseCapabilities(carcasse, fei, user),
    [carcasse, fei, user]
  );

  const viewRole: CardViewRole = user.roles.includes(UserRoles.SVI)
    ? 'svi'
    : user.roles.includes(UserRoles.ETG) || user.roles.includes(UserRoles.COLLECTEUR_PRO)
      ? 'etg-coll'
      : 'chasseur';

  const latestIntermediaire = carcassesIntermediaires[0];

  const cardDisplay = useMemo(() => {
    if (!carcasse || !fei) return null;
    return getCarcasseCardDisplay({
      carcasse,
      fei,
      latestIntermediaire,
      entities,
      viewRole,
    });
  }, [carcasse, fei, latestIntermediaire, entities, viewRole]);

  const isEcarteePourInspection =
    !!latestIntermediaire?.ecarte_pour_inspection &&
    (cardDisplay?.uiState === 'transmise' || cardDisplay?.uiState === 'acceptee-etg');

  const [selectedTab, setSelectedTab] = useState<CarcasseTab>(initialTab ?? capabilities.defaultTab);

  useEffect(() => {
    setSelectedTab(initialTab ?? capabilities.defaultTab);
  }, [initialTab, capabilities.defaultTab, carcasseId]);

  if (!carcasse || !fei || !cardDisplay) {
    return <p className="p-4 text-sm text-gray-500">Carcasse introuvable.</p>;
  }

  const tabs: Array<{ tabId: CarcasseTab; label: string }> = [
    { tabId: 'identite', label: 'Identité' },
    { tabId: 'tracabilite', label: 'Traçabilité' },
  ];
  if (capabilities.canSeeIntermediaireTab) {
    tabs.push({ tabId: 'intermediaire', label: 'Intermédiaires' });
  }
  if (capabilities.canSeeSviTab) {
    tabs.push({ tabId: 'svi', label: 'Inspection SVI' });
  }

  return (
    <div className="flex h-full flex-col">
      <CarcasseModalHeader
        carcasse={carcasse}
        feiNumero={feiNumero}
        cardDisplay={cardDisplay}
        isEcarteePourInspection={isEcarteePourInspection}
      />

      <div className="mt-4 flex-1 overflow-y-auto">
        <Tabs
          selectedTabId={selectedTab}
          tabs={tabs}
          onTabChange={(tabId) => setSelectedTab(tabId as CarcasseTab)}
        >
          {selectedTab === 'identite' && (
            <TabIdentite
              carcasse={carcasse}
              feiNumero={feiNumero}
            />
          )}
          {selectedTab === 'tracabilite' && (
            <TabTracabilite
              carcasse={carcasse}
              feiNumero={feiNumero}
            />
          )}
          {selectedTab === 'intermediaire' && capabilities.canSeeIntermediaireTab && (
            <TabIntermediaire
              carcasse={carcasse}
              feiNumero={feiNumero}
              capabilities={capabilities}
              onAfterNavigate={onAfterNavigate}
            />
          )}
          {selectedTab === 'svi' && capabilities.canSeeSviTab && (
            <TabInspectionSVI
              carcasse={carcasse}
              feiNumero={feiNumero}
              capabilities={capabilities}
              sviAccent={cardDisplay.accentColor ?? 'gray'}
              onAfterNavigate={onAfterNavigate}
            />
          )}
        </Tabs>
      </div>
    </div>
  );
}
