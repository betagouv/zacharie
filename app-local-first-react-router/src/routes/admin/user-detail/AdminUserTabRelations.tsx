import { useEffect, useMemo, useState } from 'react';
import { EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';
import type { AdminUserDetailState } from './admin-user-state';
import PeutEnvoyerDesFichesAOuTraiterAuNomDe from './PeutEnvoyerDesFichesAOuTraiterAuNomDe';
import AdminSegmentedTabs from './AdminSegmentedTabs';

type RelationsSubTabId = 'behalf' | 'transmit' | 'ccg';

type AdminUserTabRelationsProps = {
  userResponseData: AdminUserDetailState;
  setUserResponseData: (data: AdminUserDetailState) => void;
};

export default function AdminUserTabRelations({
  userResponseData,
  setUserResponseData,
}: AdminUserTabRelationsProps) {
  const { user, userEntitiesRelations } = userResponseData;

  const countBehalf = useMemo(
    () =>
      userEntitiesRelations.filter((rel) =>
        rel.EntityRelationsWithUsers.find(
          (r) => r.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY && r.owner_id === user.id,
        ),
      ).length,
    [userEntitiesRelations, user.id],
  );

  const countTransmit = useMemo(() => {
    let n = userEntitiesRelations.filter(
      (rel) =>
        rel.EntityRelationsWithUsers.some((r) => r.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) &&
        rel.type !== EntityTypes.CCG,
    ).length;
    if (user.roles.includes(UserRoles.ETG)) {
      n += 1;
    }
    return n;
  }, [user.roles, userEntitiesRelations]);

  const countCcg = useMemo(
    () => userEntitiesRelations.filter((rel) => rel.type === EntityTypes.CCG).length,
    [userEntitiesRelations],
  );

  const showTransmit = !user.roles.includes(UserRoles.SVI);
  const showCcg = user.roles.includes(UserRoles.CHASSEUR);

  const subTabs = useMemo(() => {
    const tabs: Array<{ id: RelationsSubTabId; label: string }> = [
      { id: 'behalf', label: `Au nom de (${countBehalf})` },
    ];
    if (showTransmit) {
      tabs.push({ id: 'transmit', label: `Envoi de fiches (${countTransmit})` });
    }
    if (showCcg) {
      tabs.push({ id: 'ccg', label: `CCGs (${countCcg})` });
    }
    return tabs;
  }, [countBehalf, countCcg, countTransmit, showCcg, showTransmit]);

  const firstSubTab = subTabs[0]?.id;

  const [relationsSubTabId, setRelationsSubTabId] = useState<RelationsSubTabId>('behalf');

  useEffect(() => {
    const ids = subTabs.map((t) => t.id);
    if (!ids.includes(relationsSubTabId) && firstSubTab) {
      setRelationsSubTabId(firstSubTab);
    }
  }, [subTabs, relationsSubTabId, firstSubTab]);

  return (
    <div className="fr-mt-1w">
      <p className="fr-mb-2w fr-text--xs text-[#666]">
        Liaisons pour traiter ou envoyer des fiches (compteurs à jour).
      </p>
      <AdminSegmentedTabs
        className="mb-2"
        variant="compact"
        tabs={subTabs}
        value={relationsSubTabId}
        onChange={(id) => setRelationsSubTabId(id as RelationsSubTabId)}
        ariaLabel="Types de liaison utilisateur–entité"
      />

      <div className="pt-1" role="tabpanel">
        {relationsSubTabId === 'behalf' && (
          <PeutEnvoyerDesFichesAOuTraiterAuNomDe
            relationType={EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY}
            formIdPrefix="admin-user-relations-behalf"
            userResponseData={userResponseData}
            setUserResponseData={setUserResponseData}
          />
        )}
        {relationsSubTabId === 'transmit' && showTransmit && (
          <PeutEnvoyerDesFichesAOuTraiterAuNomDe
            relationType={EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY}
            formIdPrefix="admin-user-relations-transmit"
            userResponseData={userResponseData}
            setUserResponseData={setUserResponseData}
          />
        )}
        {relationsSubTabId === 'ccg' && showCcg && (
          <PeutEnvoyerDesFichesAOuTraiterAuNomDe
            relationType={EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY}
            formIdPrefix="admin-user-relations-ccg"
            userResponseData={userResponseData}
            setUserResponseData={setUserResponseData}
            forCCG
          />
        )}
      </div>
    </div>
  );
}
