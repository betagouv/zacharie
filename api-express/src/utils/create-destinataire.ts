import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  Prisma,
  type Entity,
  type User,
  type UserRoles,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '~/prisma';
import {
  createBrevoContact,
  linkBrevoCompanyToContact,
  sendEmail,
  updateOrCreateBrevoCompany,
} from '~/third-parties/brevo';
import createUserId from '~/utils/createUserId';
import { inviteUser } from '~/utils/invite-user';
import { sanitize } from '~/utils/sanitize';

// un destinataire ne s'inscrit pas lui-même sur Zacharie : un chasseur, un ETG ou un admin
// le pré-enregistre avec le compte de son représentant, qui reçoit une invitation.
// Le collecteur pro n'est pas du circuit court, mais un chasseur peut le pré-enregistrer de la même façon.
export const destinataireSchema = z.object({
  raison_sociale: z.string(),
  address_ligne_1: z.string(),
  address_ligne_2: z.string(),
  code_postal: z.string(),
  email: z.string(),
  nom_de_famille: z.string(),
  prenom: z.string(),
  ville: z.string(),
  siret: z.string().optional(),
  zacharie_compatible: z.boolean().optional(),
  type: z.enum([
    EntityTypes.COLLECTEUR_PRO,
    EntityTypes.COMMERCE_DE_DETAIL,
    EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
    EntityTypes.ASSOCIATION_CARITATIVE,
    EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
    EntityTypes.CONSOMMATEUR_FINAL,
  ]),
});

// les entités auxquelles un chasseur transmet des carcasses
const RECIPIENT_TYPES: Array<EntityTypes> = [
  EntityTypes.ETG,
  EntityTypes.COLLECTEUR_PRO,
  EntityTypes.COMMERCE_DE_DETAIL,
  EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
  EntityTypes.ASSOCIATION_CARITATIVE,
  EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
  EntityTypes.CONSOMMATEUR_FINAL,
];

export type DestinataireInput = z.infer<typeof destinataireSchema>;

// `entity` est null quand la création est refusée : `status` et `error` portent alors la réponse HTTP.
// `existingEntity` est renseigné quand le destinataire est déjà enregistré sur Zacharie.
export type CreateDestinataireResult = {
  entity: Entity | null;
  existingEntity?: Entity;
  status: number;
  error: string;
};

export async function createDestinataire(
  body: DestinataireInput,
  invitedBy: User
): Promise<CreateDestinataireResult> {
  const data: Prisma.EntityUncheckedCreateInput = {
    raison_sociale: sanitize(body.raison_sociale).trim(),
    nom_d_usage: sanitize(body.raison_sociale).trim(),
    type: body.type,
    address_ligne_1: sanitize(body.address_ligne_1),
    address_ligne_2: sanitize(body.address_ligne_2),
    code_postal: sanitize(body.code_postal).trim(),
    ville: sanitize(body.ville),
    siret: sanitize(body.siret ?? '').replace(/\s/g, '') || null,
    zacharie_compatible: true,
  };

  // un destinataire déjà enregistré sur Zacharie ne doit pas être créé en double.
  // On le retrouve par SIRET, sinon par raison sociale + code postal, quel que soit le type saisi :
  // un ETG saisi comme commerce de détail est retrouvé comme ETG.
  const existingEntity = await prisma.entity.findFirst({
    where: {
      deleted_at: null,
      type: { in: RECIPIENT_TYPES },
      ...(data.siret
        ? { siret: data.siret }
        : {
            raison_sociale: { equals: data.raison_sociale, mode: 'insensitive' },
            code_postal: data.code_postal,
          }),
    },
  });

  if (existingEntity) {
    return { entity: null, existingEntity, status: 406, error: 'Entité déjà existante' };
  }

  // un SIRET déjà porté par une entité qui ne reçoit pas de carcasses (CCG, SVI, association de chasse)
  // est une erreur de saisie : on ne crée pas de destinataire en double
  if (data.siret) {
    const otherEntity = await prisma.entity.findFirst({
      where: { deleted_at: null, siret: data.siret },
    });
    if (otherEntity) {
      return {
        entity: null,
        status: 409,
        error: 'Ce SIRET ne correspond pas à un destinataire de carcasses. Veuillez vérifier le SIRET saisi.',
      };
    }
  }

  // on vérifie que l'email est libre AVANT de créer l'entité, sinon on laisse une entité orpheline
  const existingUser = await prisma.user.findUnique({
    where: {
      email: body.email,
    },
  });

  if (existingUser && existingUser.roles.length > 0) {
    return {
      entity: null,
      status: 409,
      error:
        "Cette adresse email est déjà associée à un compte Zacharie existant. Veuillez utiliser une autre adresse email ou contacter l'utilisateur pour qu'il ajoute lui-même cette entité à son compte.",
    };
  }

  let createdEntity = await prisma.entity.create({ data });

  createdEntity = await updateOrCreateBrevoCompany(createdEntity);

  let ownerUser: User;
  if (!existingUser) {
    ownerUser = await prisma.user.create({
      data: {
        id: await createUserId(),
        email: body.email,
        nom_de_famille: body.nom_de_famille,
        prenom: body.prenom,
        roles: [body.type as unknown as UserRoles],
      },
    });
  } else {
    // l'utilisateur existe mais n'a pas de rôles (compte vide)
    ownerUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        roles: [body.type as unknown as UserRoles],
        nom_de_famille: body.nom_de_famille,
        prenom: body.prenom,
      },
    });
  }

  await prisma.entityAndUserRelations.create({
    data: {
      owner_id: ownerUser.id,
      entity_id: createdEntity.id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: EntityRelationStatus.ADMIN,
    },
  });

  await sendEmail({
    emails: ['contact@zacharie.beta.gouv.fr'],
    subject: `Nouveau partenaire pré-enregistré dans Zacharie`,
    text: `Un nouveau partenaire a été pré-enregistré dans Zacharie : ${createdEntity.nom_d_usage}`,
  });

  ownerUser = await createBrevoContact(ownerUser, 'USER');
  await linkBrevoCompanyToContact(createdEntity, ownerUser);

  await inviteUser(ownerUser, invitedBy);

  return { entity: createdEntity, status: 200, error: '' };
}
