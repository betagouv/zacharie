import { UserRoles, type Entity, type Fei } from "@prisma/client";
import { getUserRoleLabel } from "./get-user-roles-label";
import { SerializeFrom } from "@remix-run/node";

export function getOngoingCellFeiUnderMyResponsability(
  fei: SerializeFrom<Fei>,
  entities: Record<string, SerializeFrom<Entity>>,
) {
  const role = getUserRoleLabel(fei.fei_next_owner_role ?? (fei.fei_current_owner_role as UserRoles));
  const entityName = fei.fei_next_owner_entity_id
    ? entities[fei.fei_next_owner_entity_id].nom_d_usage
    : fei.fei_current_owner_entity_id
      ? entities[fei.fei_current_owner_entity_id].nom_d_usage
      : null;
  const userName = fei.fei_next_owner_user_name_cache ?? fei.fei_current_owner_user_name_cache;
  return (
    <>
      {role}
      {entityName ? (
        <>
          <br />
          {entityName}
        </>
      ) : null}
      {userName ? (
        <>
          <br />
          {userName}
        </>
      ) : null}
    </>
  );
}
