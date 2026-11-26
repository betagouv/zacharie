import prisma from '~/prisma';

export type TrichinePartieConcernee = { id: string; nom: string };

export async function getEtgsDuServiceExpediteur(
  expediteurEntityId: string | null
): Promise<Array<TrichinePartieConcernee>> {
  if (!expediteurEntityId) return [];
  const etgs = await prisma.entity.findMany({
    where: { etg_linked_to_svi_id: expediteurEntityId, deleted_at: null },
    select: { id: true, nom_d_usage: true, raison_sociale: true },
    orderBy: { nom_d_usage: 'asc' },
  });
  return etgs.map((etg) => ({ id: etg.id, nom: etg.nom_d_usage || etg.raison_sociale || 'ETG' }));
}
