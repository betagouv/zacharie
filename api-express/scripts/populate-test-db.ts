import { EntityRelationType, EntityTypes, UserRelationType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import prisma from '~/prisma';
import { hashPassword } from '~/service/crypto';
import createUserId from '~/utils/createUserId';

export async function populateDb() {
  console.log('Populate db', process.env.NODE_ENV);
  if (process.env.NODE_ENV !== 'test') {
    console.log('Not in test environment');
    return;
  }

  await prisma.user.deleteMany();
  await prisma.password.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.entityAndUserRelations.deleteMany();
  await prisma.userRelations.deleteMany();

  /* 
  Martin
Bernard
Dubois
Thomas
Robert
Richard
Petit
Durand
Leroy
Moreau
Simon
Laurent
Lefebvre
Michel
Garcia
  */

  /* 
Marie
Pierre
Sophie
Jean
Catherine
Michel
Claire
Philippe
Anne
François
Isabelle
Nicolas
Julie
Thomas
Christine
*/
  await prisma.user.createMany({
    data: [
      {
        id: await createUserId(),
        email: 'examinateur@example.fr',
        roles: [UserRoles.EXAMINATEUR_INITIAL],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Marie',
        nom_de_famille: 'Martin',
        addresse_ligne_1: '1 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060601',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'premier-detenteur@example.fr',
        roles: [UserRoles.PREMIER_DETENTEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Pierre',
        nom_de_famille: 'Petit',
        addresse_ligne_1: '2 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060602',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'examinateur-premier-detenteur@example.fr',
        roles: [UserRoles.EXAMINATEUR_INITIAL, UserRoles.PREMIER_DETENTEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Pierre',
        nom_de_famille: 'Petit',
        addresse_ligne_1: '3 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060603',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'collecteur-pro@example.fr',
        roles: [UserRoles.COLLECTEUR_PRO],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Sophie',
        nom_de_famille: 'Bernard',
        addresse_ligne_1: '4 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060604',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'etg@example.fr',
        roles: [UserRoles.ETG],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Thomas',
        nom_de_famille: 'Robert',
        addresse_ligne_1: '5 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060605',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'collecteur-pro-etg@example.fr',
        roles: [UserRoles.COLLECTEUR_PRO, UserRoles.ETG],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Nicolas',
        nom_de_famille: 'Richard',
        addresse_ligne_1: '6 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060606',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'svi@example.fr',
        roles: [UserRoles.SVI],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Catherine',
        nom_de_famille: 'Durand',
        addresse_ligne_1: '7 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060607',
        onboarded_at: dayjs().toDate(),
      },
    ],
  });

  const users = await prisma.user.findMany();
  console.log('Users created for test', users.length);

  await prisma.password.createMany({
    data: await Promise.all(
      users.map(async (user) => ({
        user_id: user.id,
        password: await hashPassword('secret-secret'),
      })),
    ),
  });

  await prisma.entity.createMany({
    data: [
      {
        raison_sociale: 'Association de chasseurs',
        nom_d_usage: 'Association de chasseurs',
        siret: '12345678901234',
        type: EntityTypes.PREMIER_DETENTEUR,
        zacharie_compatible: true,
        address_ligne_1: '1 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'CCG Chasseurs',
        nom_d_usage: 'CCG Chasseurs',
        numero_ddecpp: 'CCG-01',
        type: EntityTypes.CCG,
        zacharie_compatible: true,
        address_ligne_1: '2 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'CCG Transporteurs',
        nom_d_usage: 'CCG Transporteurs',
        numero_ddecpp: 'CCG-02',
        type: EntityTypes.CCG,
        zacharie_compatible: true,
        address_ligne_1: '3 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'Collecteur Pro 1',
        nom_d_usage: 'Collecteur Pro 1',
        siret: '12345678901234',
        type: EntityTypes.COLLECTEUR_PRO,
        zacharie_compatible: true,
        address_ligne_1: '4 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'Collecteur Pro 2',
        nom_d_usage: 'Collecteur Pro 2',
        siret: '12345678901234',
        type: EntityTypes.COLLECTEUR_PRO,
        zacharie_compatible: true,
        address_ligne_1: '5 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'ETG 1',
        nom_d_usage: 'ETG 1',
        siret: '12345678901234',
        type: EntityTypes.ETG,
        zacharie_compatible: true,
        code_etbt_certificat: '01',
        address_ligne_1: '6 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'ETG 2',
        nom_d_usage: 'ETG 2',
        siret: '12345678901234',
        type: EntityTypes.ETG,
        zacharie_compatible: true,
        code_etbt_certificat: '02',
        address_ligne_1: '7 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'SVI 1',
        nom_d_usage: 'SVI 1',
        siret: '12345678901234',
        type: EntityTypes.SVI,
        zacharie_compatible: true,
        address_ligne_1: '8 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        raison_sociale: 'SVI 2',
        nom_d_usage: 'SVI 2',
        siret: '12345678901234',
        type: EntityTypes.SVI,
        zacharie_compatible: true,
        address_ligne_1: '9 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
      },
    ],
  });

  const entities = await prisma.entity.findMany();
  console.log('Entities created for test', entities.length);

  const userRelations = await prisma.userRelations.createMany({
    data: [
      {
        owner_id: users.find((user) => user.email === 'examinateur@example.fr')?.id,
        related_id: users.find((user) => user.email === 'premier-detenteur@example.fr')?.id,
        relation: UserRelationType.PREMIER_DETENTEUR,
      },
    ],
  });

  console.log('User relations created for test', userRelations.count);

  const entityAndUserRelations = await prisma.entityAndUserRelations.createMany({
    data: [
      {
        owner_id: users.find((user) => user.email === 'examinateur@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Association de chasseurs')?.id,
        relation: EntityRelationType.WORKING_WITH,
      },
      {
        owner_id: users.find((user) => user.email === 'premier-detenteur@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Association de chasseurs')?.id,
        relation: EntityRelationType.WORKING_FOR,
      },
      {
        owner_id: users.find((user) => user.email === 'examinateur-premier-detenteur@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Association de chasseurs')?.id,
        relation: EntityRelationType.WORKING_FOR,
      },
    ],
  });
  console.log('Entity and user relations created for test', entityAndUserRelations.count);
}

populateDb();
