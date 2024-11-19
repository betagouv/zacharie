import { UserRoles, type Entity, type Fei } from "@prisma/client";
import { getUserRoleLabel } from "./get-user-roles-label";

export function getOngoingCellFeiUnderMyResponsability(fei: Fei, entities: Record<string, Entity>) {
  const role = getUserRoleLabel(fei.fei_next_owner_role ?? (fei.fei_current_owner_role as UserRoles));
  const entityName = fei.fei_next_owner_entity_id
    ? entities[fei.fei_next_owner_entity_id]?.nom_d_usage
    : fei.fei_current_owner_entity_id
    ? entities[fei.fei_current_owner_entity_id]?.nom_d_usage
    : null;
  try {
    const entityName2 = fei.fei_next_owner_entity_id
      ? entities[fei.fei_next_owner_entity_id].nom_d_usage
      : fei.fei_current_owner_entity_id
      ? entities[fei.fei_current_owner_entity_id].nom_d_usage
      : null;
  } catch (e) {
    console.error(e);
    console.log({
      fei,
      entities,
      "fei.fei_current_owner_entity_id": fei.fei_current_owner_entity_id,
      "fei.fei_next_owner_entity_id": fei.fei_next_owner_entity_id,
      "entities[fei.fei_current_owner_entity_id]": entities[fei.fei_current_owner_entity_id!],
      "entities[fei.fei_next_owner_entity_id]": entities[fei.fei_next_owner_entity_id!],
    });
  }
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
