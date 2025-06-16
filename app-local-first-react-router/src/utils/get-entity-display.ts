import { Entity } from '@prisma/client';
import { getUserRoleLabel } from './get-user-roles-label';

export function getEntityDisplay(entity: Entity) {
  let display = entity?.nom_d_usage;
  if (entity?.numero_ddecpp) {
    display += ` - ${entity?.numero_ddecpp}`;
  }
  if (entity?.code_postal) {
    display += ` - ${entity?.code_postal} ${entity?.ville}`;
  }
  display += ` (${getUserRoleLabel(entity.type)})`;
  return display;
}
