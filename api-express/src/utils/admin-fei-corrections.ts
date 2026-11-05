import { EntityRelationType, EntityTypes } from '@prisma/client';
import prisma from '~/prisma';

// Les corrections admin d'une fiche (date, commune, premier détenteur, carcasses) ne sont possibles que
// tant qu'elle n'est pas clôturée : une clôture intermédiaire ou SVI, ou un certificat SVI émis, fige
// des documents officiels qui ne seraient plus en phase avec la fiche.
export async function getAdminFeiCorrectionsBlocage(fei_numero: string) {
  const [fei, carcasseCloturee, certificat, intermediaire] = await Promise.all([
    prisma.fei.findUnique({ where: { numero: fei_numero }, select: { deleted_at: true } }),
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
  if (!fei) blocage = 'Fiche introuvable';
  else if (fei.deleted_at) blocage = 'La fiche est supprimée';
  else if (carcasseCloturee) blocage = 'La fiche est clôturée';
  else if (certificat) blocage = 'Un certificat SVI a déjà été émis sur cette fiche';

  // Une carcasse ajoutée après une prise en charge n'apparaîtrait pas chez l'intermédiaire (il lui faut
  // sa ligne CarcasseIntermediaire) : c'est alors à lui de passer par « Ajouter une carcasse ».
  const ajoutCarcasseBlocage =
    blocage ?? (intermediaire ? 'La fiche a déjà été prise en charge par un intermédiaire' : null);

  return { blocage, ajoutCarcasseBlocage };
}

// Associations de chasse dont l'examinateur est membre : comme dans l'app (examinateur-select-next),
// c'est parmi elles, l'examinateur lui-même ou un autre chasseur qu'on choisit le premier détenteur.
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
