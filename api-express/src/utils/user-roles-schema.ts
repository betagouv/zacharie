import { UserRoles } from '@prisma/client';
import { z } from 'zod';

// un utilisateur n'a qu'un seul rôle : toute route qui reçoit `roles` le valide avec ce schéma
export const userRolesSchema = z
  .array(z.enum(Object.values(UserRoles).filter((r) => r !== UserRoles.ADMIN) as [UserRoles, ...UserRoles[]]))
  .max(1, 'Un utilisateur ne peut avoir qu’un seul rôle');

export function isRolesValidationError(error: z.ZodError) {
  return error.issues.some((issue) => issue.path[0] === 'roles');
}
