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
// le pré-enregistre avec le compte de son représentant, qui reçoit une invitation
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
    EntityTypes.COMMERCE_DE_DETAIL,
    EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
    EntityTypes.ASSOCIATION_CARITATIVE,
    EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
    EntityTypes.CONSOMMATEUR_FINAL,
  ]),
});

export type DestinataireInput = z.infer<typeof destinataireSchema>;

// `entity` est null quand la création est refusée : `status` et `error` portent alors la réponse HTTP
export type CreateDestinataireResult = {
  entity: Entity | null;
  status: number;
  error: string;
};

export async function createDestinataire(
  body: DestinataireInput,
  invitedBy: User
): Promise<CreateDestinataireResult> {
  const data: Prisma.EntityUncheckedCreateInput = {
    raison_sociale: sanitize(body.raison_sociale),
    nom_d_usage: sanitize(body.raison_sociale),
    type: body.type,
    address_ligne_1: sanitize(body.address_ligne_1),
    address_ligne_2: sanitize(body.address_ligne_2),
    code_postal: sanitize(body.code_postal),
    ville: sanitize(body.ville),
    siret: sanitize(body.siret ?? '') || null,
    zacharie_compatible: true,
  };

  const existingEntity = await prisma.entity.findFirst({
    where: {
      raison_sociale: data.raison_sociale,
      type: data.type,
      code_postal: data.code_postal,
      ville: data.ville,
      siret: data.siret,
    },
  });

  if (existingEntity) {
    return { entity: null, status: 406, error: 'Entité déjà existante' };
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
