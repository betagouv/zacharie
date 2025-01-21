import { UserRoles, type Entity, type Fei } from '@prisma/client';
import { getUserRoleLabel } from './get-user-roles-label';

export function getOngoingCellFeiUnderMyResponsability(fei: Fei, entities: Record<string, Entity>) {
  const role = getUserRoleLabel(fei.fei_next_owner_role ?? (fei.fei_current_owner_role as UserRoles));
  const entityName = fei.fei_next_owner_entity_id
    ? entities[fei.fei_next_owner_entity_id]?.nom_d_usage
    : fei.fei_current_owner_entity_id
      ? entities[fei.fei_current_owner_entity_id]?.nom_d_usage
      : null;
  try {
    const _entityName2 = fei.fei_next_owner_entity_id
      ? entities[fei.fei_next_owner_entity_id].nom_d_usage
      : fei.fei_current_owner_entity_id
        ? entities[fei.fei_current_owner_entity_id].nom_d_usage
        : null;
    if (entityName !== _entityName2) {
      console.log('PROBLEM');
    }
  } catch (e) {
    console.error(e);
    console.log({
      fei,
      entities,
      'fei.fei_current_owner_entity_id': fei.fei_current_owner_entity_id,
      'fei.fei_next_owner_entity_id': fei.fei_next_owner_entity_id,
      'entities[fei.fei_current_owner_entity_id]': entities[fei.fei_current_owner_entity_id!],
      'entities[fei.fei_next_owner_entity_id]': entities[fei.fei_next_owner_entity_id!],
    });
  }
  const userName = fei.fei_next_owner_user_name_cache ?? fei.fei_current_owner_user_name_cache;
  return (
    <span className="flex flex-col">
      <span className="opacity-40 italic mb-2">{role}</span>
      {entityName ? <span>{entityName}</span> : null}
      {userName ? <span>{userName}</span> : null}
    </span>
  );
}
