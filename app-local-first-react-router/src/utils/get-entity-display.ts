import { Entity } from '@prisma/client';
import { getUserRoleLabel } from './get-user-roles-label';

// withType : ajoute la catégorie entre parenthèses. Les chasseurs ne la voient pas, elle leur est illisible.
export function getEntityDisplay(entity: Entity, { withType = true }: { withType?: boolean } = {}) {
  let display = entity?.nom_d_usage;
  if (entity?.numero_ddecpp) {
    display += ` - ${entity?.numero_ddecpp}`;
  }
  if (entity?.code_postal) {
    display += ` - ${entity?.code_postal} ${entity?.ville}`;
  }
  if (withType) {
    display += ` (${getUserRoleLabel(entity.type)})`;
  }
  return display;
}
