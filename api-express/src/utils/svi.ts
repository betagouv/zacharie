import { EntityRelationStatus, EntityRelationType, FeiOwnerRole, Prisma } from '@prisma/client';
import prisma from '~/prisma';

// ETG rattachés au(x) SVI de l'utilisateur, avec un libellé d'affichage par ETG.
export async function getEtgsLinkedToSviUser(userId: string) {
  const sviEntityRelations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
    },
    select: { entity_id: true },
  });
  const sviEntityIds = sviEntityRelations.map((r) => r.entity_id);

  const etgs = await prisma.entity.findMany({
    where: {
      etg_linked_to_svi_id: { in: sviEntityIds },
      deleted_at: null,
    },
    select: { id: true, nom_d_usage: true, raison_sociale: true },
  });
  const etgIds = etgs.map((e) => e.id);
  const etgNameById = new Map(etgs.map((e) => [e.id, e.nom_d_usage || e.raison_sociale || 'ETG']));
  return { sviEntityIds, etgIds, etgNameById };
}

/**
 * Carcasses physiquement arrivées chez un ETG rattaché au SVI (acceptées, ni refusées ni
 * manquantes) mais pas encore transmises au SVI. Le SVI les voit avant d'en être officiellement
 * détenteur : il partage les locaux de l'ETG et y prélève la trichine dès l'arrivage.
 */
export function carcassesAVenirChezEtgWhere(etgIds: Array<string>): Prisma.CarcasseWhereInput {
  return {
    svi_assigned_at: null,
    current_owner_role: FeiOwnerRole.ETG,
    current_owner_entity_id: { in: etgIds },
    CarcasseIntermediaire: {
      some: {
        intermediaire_entity_id: { in: etgIds },
        prise_en_charge: true,
        refus: null,
        manquante: { not: true },
        deleted_at: null,
      },
    },
  };
}
