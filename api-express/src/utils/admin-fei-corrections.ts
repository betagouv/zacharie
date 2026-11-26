import { EntityRelationType, EntityTypes } from '@prisma/client';
import type { Fei } from '@prisma/client';
import prisma from '~/prisma';

export async function getAdminFeiCorrectionsBlocage(fei: Pick<Fei, 'numero' | 'deleted_at'> | null) {
  if (!fei) return { blocage: 'Fiche introuvable', ajoutCarcasseBlocage: 'Fiche introuvable' };
  const fei_numero = fei.numero;
  const [carcasseCloturee, certificat, intermediaire] = await Promise.all([
    prisma.carcasse.findFirst({
      where: {
        fei_numero,
        deleted_at: null,
        OR: [
          { intermediaire_closed_at: { not: null } },
          { svi_closed_at: { not: null } },
          { svi_automatic_closed_at: { not: null } },
        ],
      },
      select: { zacharie_carcasse_id: true },
    }),
    prisma.carcasseCertificat.findFirst({ where: { fei_numero }, select: { certificat_id: true } }),
    prisma.carcasseIntermediaire.findFirst({
      where: { fei_numero, deleted_at: null },
      select: { intermediaire_id: true },
    }),
  ]);

  let blocage: string | null = null;
  if (fei.deleted_at) blocage = 'La fiche est supprimée';
  else if (carcasseCloturee) blocage = 'La fiche est clôturée';
  else if (certificat) blocage = 'Un certificat SVI a déjà été émis sur cette fiche';

  const ajoutCarcasseBlocage =
    blocage ?? (intermediaire ? 'La fiche a déjà été prise en charge par un intermédiaire' : null);

  return { blocage, ajoutCarcasseBlocage };
}

export async function getAssociationsDeChasse(examinateur_user_id: string | null) {
  if (!examinateur_user_id) return [];
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: examinateur_user_id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      deleted_at: null,
      EntityRelatedWithUser: { type: EntityTypes.PREMIER_DETENTEUR, deleted_at: null },
    },
    select: { EntityRelatedWithUser: { select: { id: true, nom_d_usage: true } } },
  });
  return relations.map((relation) => relation.EntityRelatedWithUser);
}
