import prisma from '~/prisma';

export type TrichinePartieConcernee = { id: string; nom: string };

/**
 * ETG où opère le service d'inspection expéditeur : en circuit agréé le SVI prélève et expédie
 * depuis l'atelier de traitement auquel il est rattaché (`Entity.etg_linked_to_svi_id`).
 * Vide quand l'expéditeur n'est pas un service d'inspection — aucun ETG ne pointe alors vers lui.
 */
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
