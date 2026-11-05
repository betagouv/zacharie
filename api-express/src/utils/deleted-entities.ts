import prisma from '~/prisma';
import { SyncRejectedError } from '~/utils/sync-errors';

// Une entité supprimée par l'admin disparaît des listes, mais la copie locale d'un utilisateur peut
// encore la proposer (il la connaissait avant la suppression, ou il est hors ligne). On refuse donc
// qu'une fiche ou une carcasse la désigne. Seules les valeurs qui changent sont vérifiées : une
// fiche rattachée à l'entité avant sa suppression continue de se synchroniser.

export async function findDeletedEntityIds(entityIds: Array<string>): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set();
  const deletedEntities = await prisma.entity.findMany({
    where: { id: { in: [...new Set(entityIds)] }, deleted_at: { not: null } },
    select: { id: true },
  });
  return new Set(deletedEntities.map((e) => e.id));
}

export async function assertNoNewDeletedEntity<T extends string>(
  body: Partial<Record<T, unknown>>,
  existing: Partial<Record<T, unknown>> | null,
  fields: ReadonlyArray<T>,
  // pré-chargées par l'appelant pour tout le lot ; sinon on requête
  deletedEntityIds?: Set<string>
) {
  const newEntityIds = fields
    .filter((field) => !!body[field] && body[field] !== existing?.[field])
    .map((field) => body[field] as string);
  if (newEntityIds.length === 0) return;
  const deleted = deletedEntityIds ?? (await findDeletedEntityIds(newEntityIds));
  if (newEntityIds.some((id) => deleted.has(id))) {
    throw new SyncRejectedError('Cette entité a été supprimée, choisissez-en une autre');
  }
}
