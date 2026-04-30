import {
  ApiKeyScope,
  CarcasseStatus,
  CarcasseType,
  DepotType,
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  Prisma,
  TransportType,
  Fei,
  UserEtgRoles,
  UserRelationType,
  UserRoles,
  Carcasse,
} from '@prisma/client';
import dayjs from 'dayjs';
import prisma from '~/prisma';
import { hashPassword } from '~/service/crypto';
import createUserId from '~/utils/createUserId';

export async function populateDb(role?: FeiOwnerRole) {
  console.log('Populate db', process.env.NODE_ENV, process.env.POSTGRESQL_ADDON_URI);
  if (process.env.NODE_ENV !== 'test') {
    console.log('Not in test environment');
    return;
  }
  if (process.env.POSTGRESQL_ADDON_URI !== 'postgres://postgres:postgres@localhost:5432/zacharietest') {
    console.log('Not the test db 🤪');
    return;
  }

  // Delete in FK-safe order: children before parents
  await prisma.log.deleteMany();
  await prisma.carcasseIntermediaire.deleteMany();
  await prisma.carcasse.deleteMany();
  await prisma.fei.deleteMany();
  await prisma.entityAndUserRelations.deleteMany();
  await prisma.userRelations.deleteMany();
  await prisma.apiKeyLog.deleteMany();
  await prisma.apiKeyApprovalByUserOrEntity.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.password.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.user.deleteMany();

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
        id: 'QZ6E0',
        email: 'examinateur@example.fr',
        roles: [UserRoles.CHASSEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Marie',
        nom_de_famille: 'Martin',
        addresse_ligne_1: '1 rue de la paix',
        est_forme_a_l_examen_initial: true,
        numero_cfei: 'CFEI-075-25-001',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060601',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: '0Y545',
        email: 'premier-detenteur@example.fr',
        roles: [UserRoles.CHASSEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        user_entities_vivible_checkbox: true,
        est_forme_a_l_examen_initial: false,
        prenom: 'Pierre',
        nom_de_famille: 'Petit',
        addresse_ligne_1: '2 rue de la paix',
        numero_cfei: null,
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060602',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'examinateur-premier-detenteur@example.fr',
        roles: [UserRoles.CHASSEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Pierre',
        nom_de_famille: 'Petit',
        addresse_ligne_1: '3 rue de la paix',
        est_forme_a_l_examen_initial: true,
        numero_cfei: 'CFEI-075-25-002',
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
        email: 'collecteur-pro-nouveau@example.fr',
        roles: [UserRoles.COLLECTEUR_PRO],
        activated: true,
        activated_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'etg-1@example.fr',
        roles: [UserRoles.ETG],
        etg_role: UserEtgRoles.RECEPTION,
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
        email: 'etg-2@example.fr',
        roles: [UserRoles.ETG],
        etg_role: UserEtgRoles.RECEPTION,
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Matthias',
        nom_de_famille: 'Michu',
        addresse_ligne_1: '5 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060606',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'collecteur-pro-1-etg-1@example.fr',
        roles: [UserRoles.ETG],
        etg_role: UserEtgRoles.TRANSPORT,
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
        email: 'etg-nouveau@example.fr',
        roles: [UserRoles.ETG],
        activated: true,
        activated_at: dayjs().toDate(),
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
      {
        id: await createUserId(),
        email: 'svi-nouveau@example.fr',
        roles: [UserRoles.SVI],
        activated: true,
        activated_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'commerce-de-detail@example.fr',
        roles: [UserRoles.COMMERCE_DE_DETAIL],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Julie',
        nom_de_famille: 'Leroy',
        addresse_ligne_1: '10 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060608',
        onboarded_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'commerce-de-detail-nouveau@example.fr',
        roles: [UserRoles.COMMERCE_DE_DETAIL],
        activated: true,
        activated_at: dayjs().toDate(),
      },
      {
        id: await createUserId(),
        email: 'examinateur-onboarding@example.fr',
        roles: [UserRoles.CHASSEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        // Intentionally no prenom, nom, address, telephone, est_forme_a_l_examen_initial
        // Used by specs 9/10 to test onboarding-incomplete gate
      },
      {
        id: await createUserId(),
        email: 'examinateur-sans-formation@example.fr',
        roles: [UserRoles.CHASSEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'Anne',
        nom_de_famille: 'Lefebvre',
        addresse_ligne_1: '11 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060609',
        // est_forme_a_l_examen_initial is null (default)
        // Used by spec 11: profile complete but formation missing
      },
      {
        id: await createUserId(),
        email: 'premier-detenteur-onboarding@example.fr',
        roles: [UserRoles.CHASSEUR],
        activated: true,
        activated_at: dayjs().toDate(),
        est_forme_a_l_examen_initial: false,
        // No prenom, nom, address — used by spec 31
      },
      {
        id: await createUserId(),
        email: 'svi-2@example.fr',
        roles: [UserRoles.SVI],
        activated: true,
        activated_at: dayjs().toDate(),
        prenom: 'François',
        nom_de_famille: 'Garcia',
        addresse_ligne_1: '12 rue de la paix',
        code_postal: '75000',
        ville: 'Paris',
        telephone: '0606060610',
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
      }))
    ),
  });

  await prisma.entity.createMany({
    data: [
      {
        id: '37a59a18-7f29-4177-a019-aafad6c73ee0',
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
        id: '04881d2b-9b27-42a1-8092-7080c67e90fe',
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

  await prisma.entity.createMany({
    data: [
      {
        id: '5b916331-632e-4c29-be2e-12a834e92688',
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
        id: '4f67364a-8373-49f9-a4f6-31a0d88ba27b',
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
        id: '6c09e89c-5da7-4864-b3b4-11cc34468745',
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
        id: 'a447bab1-8796-48a4-b955-3a5466116bca',
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
        id: '94684af1-ac01-46eb-8ff4-18dcb7ff560c',
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
        id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
        raison_sociale: 'ETG 1',
        nom_d_usage: 'ETG 1',
        siret: '12345678901234',
        type: EntityTypes.ETG,
        zacharie_compatible: true,
        code_etbt_certificat: '01',
        address_ligne_1: '6 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
        etg_linked_to_svi_id: '37a59a18-7f29-4177-a019-aafad6c73ee0',
      },
      {
        id: '8cb0e705-6bbe-43b1-af4a-2daa90db92e0',
        raison_sociale: 'ETG 2',
        nom_d_usage: 'ETG 2',
        siret: '12345678901234',
        type: EntityTypes.ETG,
        zacharie_compatible: true,
        code_etbt_certificat: '02',
        address_ligne_1: '7 avenue du général de gaulle',
        code_postal: '75000',
        ville: 'Paris',
        etg_linked_to_svi_id: '04881d2b-9b27-42a1-8092-7080c67e90fe',
      },
      {
        id: 'b5d31c7f-5e5a-4c2c-9e37-1e6b2d8c4f10',
        raison_sociale: 'Commerce de Détail 1',
        nom_d_usage: 'Commerce de Détail 1',
        siret: '12345678901234',
        type: EntityTypes.COMMERCE_DE_DETAIL,
        zacharie_compatible: true,
        address_ligne_1: '8 avenue du général de gaulle',
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
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      },
      {
        owner_id: users.find((user) => user.email === 'premier-detenteur@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Association de chasseurs')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
      {
        owner_id: users.find((user) => user.email === 'examinateur-premier-detenteur@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Association de chasseurs')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
      {
        owner_id: users.find((user) => user.email === 'examinateur-premier-detenteur@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'ETG 1')?.id,
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      },
      {
        owner_id: users.find((user) => user.email === 'collecteur-pro@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Collecteur Pro 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
      {
        owner_id: users.find((user) => user.email === 'collecteur-pro-nouveau@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Collecteur Pro 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
      },
      {
        owner_id: users.find((user) => user.email === 'etg-1@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'ETG 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
      {
        owner_id: users.find((user) => user.email === 'etg-2@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'ETG 2')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
      {
        owner_id: users.find((user) => user.email === 'etg-nouveau@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'ETG 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
      },
      {
        owner_id: users.find((user) => user.email === 'svi@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'SVI 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
      {
        owner_id: users.find((user) => user.email === 'svi-nouveau@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'SVI 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
      },
      {
        owner_id: users.find((user) => user.email === 'commerce-de-detail@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Commerce de Détail 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
      {
        owner_id: users.find((user) => user.email === 'commerce-de-detail-nouveau@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Commerce de Détail 1')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
      },
      {
        owner_id: users.find((user) => user.email === 'svi-2@example.fr')?.id,
        entity_id: entities.find((entity) => entity.raison_sociale === 'SVI 2')?.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
    ],
  });
  console.log('Entity and user relations created for test', entityAndUserRelations.count);

  // API key for partage-de-mes-donnees test
  const apiKeyDedicated = await prisma.apiKey.create({
    data: {
      name: 'Test API Key Dedicated',
      description: 'Clé dédiée pour tests E2E',
      private_key: 'test-private-key-dedicated',
      public_key: 'test-public-key-dedicated',
      active: true,
      dedicated_to_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb', // ETG 1
      scopes: [ApiKeyScope.FEI_READ_FOR_ENTITY, ApiKeyScope.CARCASSE_READ_FOR_ENTITY],
    },
  });
  await prisma.apiKeyApprovalByUserOrEntity.create({
    data: {
      api_key_id: apiKeyDedicated.id,
      entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb', // ETG 1
      status: 'PENDING',
    },
  });

  const apiKeyUser = await prisma.apiKey.create({
    data: {
      name: 'Test API Key User',
      description: 'Clé utilisateur pour tests E2E',
      private_key: 'test-private-key-user',
      public_key: 'test-public-key-user',
      active: true,
      scopes: [ApiKeyScope.FEI_READ_FOR_USER, ApiKeyScope.CARCASSE_READ_FOR_USER],
    },
  });
  const etg1User = users.find((u) => u.email === 'etg-1@example.fr');
  if (etg1User) {
    await prisma.apiKeyApprovalByUserOrEntity.create({
      data: {
        api_key_id: apiKeyUser.id,
        user_id: etg1User.id,
        status: 'PENDING',
      },
    });
  }

  console.log('API keys created for test');

  if (role) {
    if (role === FeiOwnerRole.PREMIER_DETENTEUR) {
      const fei = await prisma.fei.create({ data: feiValidatedByExaminateur });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (for premier détenteur)`);
    }
    if (role === FeiOwnerRole.ETG) {
      const fei = await prisma.fei.create({ data: feiValidatedByPremierDetenteur });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      // await prisma.carcasseIntermediaire.createMany({
      //   data: getCarcasses(fei).map((c) => ({
      //     fei_numero: fei.numero,
      //     numero_bracelet: c.numero_bracelet,
      //     zacharie_carcasse_id: c.zacharie_carcasse_id!,
      //     intermediaire_id: `${fei.numero}_${'2a8bc866-a709-47d9-aebe-2768fceb2ecb'}_${users.find((u) => u.email === 'etg-1@example.fr')?.id}`,
      //     intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
      //     intermediaire_user_id: users.find((u) => u.email === 'etg-1@example.fr')?.id ?? '',
      //     intermediaire_role: FeiOwnerRole.ETG,
      //     prise_en_charge_at: dayjs().subtract(2, 'day').toDate(),
      //   })),
      // });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (for etg)`);
    }
    if (role === FeiOwnerRole.COLLECTEUR_PRO) {
      const fei = await prisma.fei.create({ data: feiValidatedByPremierDetenteurToCollecteur });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      // await prisma.carcasseIntermediaire.createMany({
      //   data: getCarcasses(fei).map((c) => ({
      //     fei_numero: fei.numero,
      //     numero_bracelet: c.numero_bracelet,
      //     zacharie_carcasse_id: c.zacharie_carcasse_id!,
      //     intermediaire_id: `${fei.numero}_${'a447bab1-8796-48a4-b955-3a5466116bca'}_${users.find((u) => u.email === 'collecteur-pro@example.fr')?.id}`,
      //     intermediaire_entity_id: 'a447bab1-8796-48a4-b955-3a5466116bca',
      //     intermediaire_user_id: users.find((u) => u.email === 'collecteur-pro@example.fr')?.id ?? '',
      //     intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
      //     prise_en_charge_at: dayjs().subtract(2, 'day').toDate(),
      //   })),
      // });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (for collecteur pro)`);
    }
    if (role === FeiOwnerRole.SVI) {
      const fei = await prisma.fei.create({ data: feiTransmittedByEtgToSvi });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      // Create CarcasseIntermediaire for ETG 1 so the traçabilité chain is coherent
      await prisma.carcasseIntermediaire.createMany({
        data: getCarcasses(fei).map((c) => ({
          fei_numero: fei.numero,
          numero_bracelet: c.numero_bracelet,
          zacharie_carcasse_id: c.zacharie_carcasse_id!,
          intermediaire_id: `${fei.numero}_${'2a8bc866-a709-47d9-aebe-2768fceb2ecb'}_${users.find((u) => u.email === 'etg-1@example.fr')?.id}`,
          intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
          intermediaire_user_id: users.find((u) => u.email === 'etg-1@example.fr')?.id ?? '',
          intermediaire_role: FeiOwnerRole.ETG,
          prise_en_charge_at: dayjs().subtract(2, 'day').toDate(),
        })),
      });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (for svi)`);
    }
    if (role === FeiOwnerRole.COMMERCE_DE_DETAIL) {
      const fei = await prisma.fei.create({ data: feiTransmittedByPremierDetenteurToCommerceDeDetail });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (for commerce de détail)`);
    }
    // Not a FeiOwnerRole value — special "SVI already closed" seed for testing read-only downstream views.
    if ((role as string) === 'SVI_CLOSED') {
      const fei = await prisma.fei.create({ data: feiClosedBySvi });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      // Create CarcasseIntermediaire for ETG 1 so the traçabilité chain is coherent
      await prisma.carcasseIntermediaire.createMany({
        data: getCarcasses(fei).map((c) => ({
          fei_numero: fei.numero,
          numero_bracelet: c.numero_bracelet,
          zacharie_carcasse_id: c.zacharie_carcasse_id!,
          intermediaire_id: `${fei.numero}_${'2a8bc866-a709-47d9-aebe-2768fceb2ecb'}_${users.find((u) => u.email === 'etg-1@example.fr')?.id}`,
          intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
          intermediaire_user_id: users.find((u) => u.email === 'etg-1@example.fr')?.id ?? '',
          intermediaire_role: FeiOwnerRole.ETG,
          prise_en_charge_at: dayjs().subtract(2, 'day').toDate(),
        })),
      });
      // Set per-carcasse SVI decisions so downstream views show real decisions
      await prisma.carcasse.updateMany({
        where: { fei_numero: fei.numero },
        data: {
          svi_carcasse_status: CarcasseStatus.ACCEPTE,
          svi_carcasse_status_set_at: dayjs().subtract(2, 'day').toDate(),
        },
      });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (SVI closed)`);
    }
    if ((role as string) === 'ETG_REFUSED') {
      const etg1User = users.find((u) => u.email === 'etg-1@example.fr');
      const etg1UserId = etg1User?.id ?? '';
      // Set latest_intermediaire_user_id + intermediaire_closed_by_user_id on the fei now that
      // we have the dynamic ETG user id. (FeiUncheckedCreateInput doesn't allow async lookups.)
      const fei = await prisma.fei.create({
        data: {
          ...feiRefusedByEtg,
          latest_intermediaire_user_id: etg1UserId,
          intermediaire_closed_by_user_id: etg1UserId,
          fei_current_owner_user_id: null, // owned by entity, no specific user
        },
      });
      // The carcasse refus_intermediaire_id must match the CarcasseIntermediaire.intermediaire_id
      // we create below. Format mirrors prod: "{user_id}_{fei_numero}_reception".
      const intermediaireId = `${etg1UserId}_${fei.numero}_reception`;
      const refusedAt = dayjs().subtract(1, 'day').toDate();
      const carcasses = await prisma.carcasse.createMany({
        data: getCarcasses(fei).map((c) => ({
          ...c,
          svi_carcasse_status: CarcasseStatus.REFUS_ETG_COLLECTEUR,
          svi_carcasse_status_set_at: refusedAt,
          intermediaire_carcasse_refus_intermediaire_id: intermediaireId,
          intermediaire_carcasse_refus_motif: 'Présence de souillures',
          latest_intermediaire_signed_at: refusedAt,
        })),
      });
      // Create the matching CarcasseIntermediaire record (one per carcasse) for the ETG reception.
      await prisma.carcasseIntermediaire.createMany({
        data: getCarcasses(fei).map((c) => ({
          fei_numero: fei.numero,
          numero_bracelet: c.numero_bracelet,
          zacharie_carcasse_id: c.zacharie_carcasse_id!,
          intermediaire_id: intermediaireId,
          intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
          intermediaire_user_id: etg1UserId,
          intermediaire_role: FeiOwnerRole.ETG,
          prise_en_charge: false,
          refus: 'Présence de souillures',
          decision_at: refusedAt,
          prise_en_charge_at: dayjs().subtract(1, 'day').toDate(),
        })),
      });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (ETG refused)`);
    }
    if ((role as string) === 'COMMERCE_DE_DETAIL_DELIVERED') {
      const fei = await prisma.fei.create({ data: feiDeliveredToCommerceDeDetail });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      console.log(
        `Fei ${fei.numero} created with ${carcasses.count} carcasses (delivered to commerce de détail)`
      );
    }
    if ((role as string) === 'ETG_TAKEN_CHARGE') {
      const fei = await prisma.fei.create({ data: feiTakenChargeByEtg });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      await prisma.carcasseIntermediaire.createMany({
        data: getCarcasses(fei).map((c) => ({
          fei_numero: fei.numero,
          numero_bracelet: c.numero_bracelet,
          zacharie_carcasse_id: c.zacharie_carcasse_id!,
          intermediaire_id: `${fei.numero}_${'2a8bc866-a709-47d9-aebe-2768fceb2ecb'}_${users.find((u) => u.email === 'etg-1@example.fr')?.id}`,
          intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
          intermediaire_user_id: users.find((u) => u.email === 'etg-1@example.fr')?.id ?? '',
          intermediaire_role: FeiOwnerRole.ETG,
          prise_en_charge_at: dayjs().subtract(1, 'day').toDate(),
        })),
      });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (ETG taken charge)`);
    }
    if ((role as string) === 'COLLECTEUR_TAKEN_CHARGE') {
      const fei = await prisma.fei.create({ data: feiTakenChargeByCollecteur });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      await prisma.carcasseIntermediaire.createMany({
        data: getCarcasses(fei).map((c) => ({
          fei_numero: fei.numero,
          numero_bracelet: c.numero_bracelet,
          zacharie_carcasse_id: c.zacharie_carcasse_id!,
          intermediaire_id: `${fei.numero}_${'a447bab1-8796-48a4-b955-3a5466116bca'}_${users.find((u) => u.email === 'collecteur-pro@example.fr')?.id}`,
          intermediaire_entity_id: 'a447bab1-8796-48a4-b955-3a5466116bca',
          intermediaire_user_id: users.find((u) => u.email === 'collecteur-pro@example.fr')?.id ?? '',
          intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
          prise_en_charge_at: dayjs().subtract(1, 'day').toDate(),
        })),
      });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (Collecteur taken charge)`);
    }
    if ((role as string) === 'PREMIER_DETENTEUR_WITH_PARTAGE') {
      const fei = await prisma.fei.create({ data: feiValidatedByExaminateur });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      const pdUser = users.find((u) => u.email === 'premier-detenteur@example.fr');
      if (pdUser) {
        const apiKeyPd = await prisma.apiKey.create({
          data: {
            name: 'Test API Key Partage PD',
            description: 'Clé pour test partage-de-mes-donnees PD',
            private_key: 'test-private-key-partage-pd',
            public_key: 'test-public-key-partage-pd',
            active: true,
            scopes: [ApiKeyScope.FEI_READ_FOR_USER, ApiKeyScope.CARCASSE_READ_FOR_USER],
          },
        });
        await prisma.apiKeyApprovalByUserOrEntity.create({
          data: {
            api_key_id: apiKeyPd.id,
            user_id: pdUser.id,
            status: 'PENDING',
          },
        });
      }
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (PD with partage approval)`);
    }
    if ((role as string) === 'ETG_ALL_REFUSED_TO_SVI') {
      const fei = await prisma.fei.create({ data: feiAllRefusedByEtgToSvi });
      const carcasses = await prisma.carcasse.createMany({ data: getCarcasses(fei) });
      await prisma.carcasseIntermediaire.createMany({
        data: getCarcasses(fei).map((c) => ({
          fei_numero: fei.numero,
          numero_bracelet: c.numero_bracelet,
          zacharie_carcasse_id: c.zacharie_carcasse_id!,
          intermediaire_id: `${fei.numero}_${'2a8bc866-a709-47d9-aebe-2768fceb2ecb'}_${users.find((u) => u.email === 'etg-1@example.fr')?.id}`,
          intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
          intermediaire_user_id: users.find((u) => u.email === 'etg-1@example.fr')?.id ?? '',
          intermediaire_role: FeiOwnerRole.ETG,
          prise_en_charge_at: dayjs().subtract(2, 'day').toDate(),
        })),
      });
      await prisma.carcasse.updateMany({
        where: { fei_numero: fei.numero },
        data: {
          intermediaire_carcasse_refus_intermediaire_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
          intermediaire_carcasse_refus_motif: 'Présence de souillures',
        },
      });
      console.log(`Fei ${fei.numero} created with ${carcasses.count} carcasses (ETG all refused to SVI)`);
    }
  }

  console.log('Database populated successfully');
}

const withRole = process.argv.find((arg) => arg.includes('--role'));
if (withRole) {
  const roleArg = withRole?.split('=')[1];
  console.log('Populate db with role', roleArg);
  populateDb(roleArg as FeiOwnerRole);
} else {
  populateDb();
}

const feiValidatedByExaminateur: Prisma.FeiUncheckedCreateInput = {
  numero: 'ZACH-20250707-QZ6E0-155242',
  date_mise_a_mort: '2025-07-07T00:00:00.000Z',
  commune_mise_a_mort: '03510 CHASSENARD',
  created_by_user_id: 'QZ6E0',
  fei_current_owner_user_id: 'QZ6E0',
  fei_current_owner_user_name_cache: 'Marie Martin',
  fei_current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
  examinateur_initial_user_id: 'QZ6E0',
  examinateur_initial_approbation_mise_sur_le_marche: true,
  examinateur_initial_date_approbation_mise_sur_le_marche: '2025-07-07T13:52:52.026Z',
  heure_mise_a_mort_premiere_carcasse: '12:12',
  heure_evisceration_derniere_carcasse: '12:14',
  resume_nombre_de_carcasses: '4 daims',
  fei_next_owner_user_id: '0Y545',
  fei_next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  fei_next_owner_user_name_cache: 'Pierre Petit',
};

const feiValidatedByPremierDetenteur: Prisma.FeiUncheckedCreateInput = {
  ...feiValidatedByExaminateur,
  numero: 'ZACH-20250707-QZ6E0-165242',
  fei_current_owner_user_id: '0Y545',
  fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  fei_next_owner_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  fei_next_owner_role: FeiOwnerRole.ETG,
  fei_prev_owner_user_id: 'QZ6E0',
  fei_prev_owner_entity_id: null,
  fei_prev_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
  premier_detenteur_user_id: '0Y545',
  premier_detenteur_depot_entity_id: '4f67364a-8373-49f9-a4f6-31a0d88ba27b',
  premier_detenteur_depot_entity_name_cache: 'CCG Chasseurs',
  fei_current_owner_user_name_cache: 'Pierre Petit',
  premier_detenteur_prochain_detenteur_id_cache: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  premier_detenteur_prochain_detenteur_role_cache: FeiOwnerRole.ETG,
  premier_detenteur_depot_type: DepotType.CCG,
  premier_detenteur_transport_type: TransportType.COLLECTEUR_PRO,
  premier_detenteur_depot_ccg_at: '2025-07-07T15:47:00.000Z',
};

const feiValidatedByPremierDetenteurToCollecteur: Prisma.FeiUncheckedCreateInput = {
  ...feiValidatedByPremierDetenteur,
  numero: 'ZACH-20250707-QZ6E0-175242',
  fei_next_owner_entity_id: 'a447bab1-8796-48a4-b955-3a5466116bca',
  fei_next_owner_role: FeiOwnerRole.COLLECTEUR_PRO,
  premier_detenteur_prochain_detenteur_id_cache: 'a447bab1-8796-48a4-b955-3a5466116bca',
  premier_detenteur_prochain_detenteur_role_cache: FeiOwnerRole.COLLECTEUR_PRO,
};

const feiTransmittedByEtgToSvi: Prisma.FeiUncheckedCreateInput = {
  ...feiValidatedByPremierDetenteur,
  numero: 'ZACH-20250707-QZ6E0-185242',
  fei_current_owner_entity_id: '37a59a18-7f29-4177-a019-aafad6c73ee0',
  fei_current_owner_entity_name_cache: 'SVI 1',
  fei_current_owner_role: FeiOwnerRole.SVI,
  fei_current_owner_user_id: null,
  fei_current_owner_user_name_cache: null,
  fei_prev_owner_user_id: null,
  fei_prev_owner_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  fei_prev_owner_role: FeiOwnerRole.ETG,
  fei_next_owner_entity_id: null,
  fei_next_owner_role: null,
  svi_assigned_at: dayjs().subtract(1, 'day').toDate(),
  svi_entity_id: '37a59a18-7f29-4177-a019-aafad6c73ee0',
  latest_intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  latest_intermediaire_name_cache: 'ETG 1',
};

const feiTransmittedByPremierDetenteurToCommerceDeDetail: Prisma.FeiUncheckedCreateInput = {
  ...feiValidatedByPremierDetenteur,
  numero: 'ZACH-20250707-QZ6E0-195242',
  fei_next_owner_entity_id: 'b5d31c7f-5e5a-4c2c-9e37-1e6b2d8c4f10',
  fei_next_owner_role: FeiOwnerRole.COMMERCE_DE_DETAIL,
  premier_detenteur_prochain_detenteur_id_cache: 'b5d31c7f-5e5a-4c2c-9e37-1e6b2d8c4f10',
  premier_detenteur_prochain_detenteur_role_cache: FeiOwnerRole.COMMERCE_DE_DETAIL,
};

const feiDeliveredToCommerceDeDetail: Prisma.FeiUncheckedCreateInput = {
  ...feiTransmittedByPremierDetenteurToCommerceDeDetail,
  numero: 'ZACH-20250707-QZ6E0-255242',
  consommateur_final_usage_domestique: dayjs().subtract(1, 'day').toDate(),
  fei_current_owner_user_id: null,
  fei_current_owner_user_name_cache: null,
  fei_current_owner_entity_id: 'b5d31c7f-5e5a-4c2c-9e37-1e6b2d8c4f10',
  fei_current_owner_entity_name_cache: 'Commerce de Détail 1',
  fei_current_owner_role: FeiOwnerRole.COMMERCE_DE_DETAIL,
  fei_prev_owner_user_id: '0Y545',
  fei_prev_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  fei_next_owner_entity_id: null,
  fei_next_owner_role: null,
};

const feiTakenChargeByEtg: Prisma.FeiUncheckedCreateInput = {
  ...feiValidatedByPremierDetenteur,
  numero: 'ZACH-20250707-QZ6E0-235242',
  fei_current_owner_user_id: null,
  fei_current_owner_user_name_cache: null,
  fei_current_owner_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  fei_current_owner_entity_name_cache: 'ETG 1',
  fei_current_owner_role: FeiOwnerRole.ETG,
  fei_prev_owner_user_id: '0Y545',
  fei_prev_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  fei_next_owner_entity_id: null,
  fei_next_owner_role: null,
  latest_intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  latest_intermediaire_name_cache: 'ETG 1',
};

const feiTakenChargeByCollecteur: Prisma.FeiUncheckedCreateInput = {
  ...feiValidatedByPremierDetenteurToCollecteur,
  numero: 'ZACH-20250707-QZ6E0-245242',
  fei_current_owner_user_id: null,
  fei_current_owner_user_name_cache: null,
  fei_current_owner_entity_id: 'a447bab1-8796-48a4-b955-3a5466116bca',
  fei_current_owner_entity_name_cache: 'Collecteur Pro 1',
  fei_current_owner_role: FeiOwnerRole.COLLECTEUR_PRO,
  fei_prev_owner_user_id: '0Y545',
  fei_prev_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  fei_next_owner_entity_id: null,
  fei_next_owner_role: null,
  latest_intermediaire_entity_id: 'a447bab1-8796-48a4-b955-3a5466116bca',
  latest_intermediaire_name_cache: 'Collecteur Pro 1',
};

const feiClosedBySvi: Prisma.FeiUncheckedCreateInput = {
  ...feiTransmittedByEtgToSvi,
  numero: 'ZACH-20250707-QZ6E0-205242',
  svi_assigned_at: dayjs().subtract(12, 'day').toDate(),
  svi_closed_at: dayjs().subtract(2, 'day').toDate(),
  // SVI users created via createUserId are dynamic; real closure would set svi_closed_by_user_id.
  // For fixture simplicity we leave it null; assert on svi_closed_at in tests.
};

const feiAllRefusedByEtgToSvi: Prisma.FeiUncheckedCreateInput = {
  ...feiTransmittedByEtgToSvi,
  numero: 'ZACH-20250707-QZ6E0-225242',
};

const feiRefusedByEtg: Prisma.FeiUncheckedCreateInput = {
  ...feiValidatedByPremierDetenteur,
  numero: 'ZACH-20250707-QZ6E0-215242',
  // When ETG refuses all carcasses, the fiche STAYS at the ETG (terminal state with
  // intermediaire_closed_at set) — it does NOT get sent back to the PD.
  fei_current_owner_role: FeiOwnerRole.ETG,
  fei_current_owner_user_id: null,
  fei_current_owner_user_name_cache: null,
  fei_current_owner_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  fei_current_owner_entity_name_cache: 'ETG 1',
  fei_prev_owner_user_id: '0Y545',
  fei_prev_owner_entity_id: null,
  fei_prev_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  fei_next_owner_user_id: null,
  fei_next_owner_user_name_cache: null,
  fei_next_owner_entity_id: null,
  fei_next_owner_role: null,
  intermediaire_closed_at: dayjs().subtract(1, 'day').toDate(),
  intermediaire_closed_by_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  latest_intermediaire_entity_id: '2a8bc866-a709-47d9-aebe-2768fceb2ecb',
  latest_intermediaire_name_cache: 'ETG 1',
};

function getCarcasses(fei: Fei): Array<Prisma.CarcasseUncheckedCreateInput> {
  const feiNumero = fei.numero;
  return [
    {
      fei_numero: feiNumero,
      date_mise_a_mort: '2025-07-07T00:00:00.000Z',
      numero_bracelet: 'MM-001-001',
      espece: 'Daim',
      examinateur_signed_at: '2025-07-07T14:24:19.272Z',
      examinateur_anomalies_abats: ['Abcès ou nodules Unique - Appareil respiratoire (sinus/trachée/poumon)'],
      nombre_d_animaux: 1,
      type: CarcasseType.GROS_GIBIER,
      zacharie_carcasse_id: `${feiNumero}_MM-001-001`,
      svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    },
    {
      fei_numero: feiNumero,
      date_mise_a_mort: '2025-07-07T00:00:00.000Z',
      numero_bracelet: 'MM-001-002',
      espece: 'Daim',
      examinateur_anomalies_carcasse: ['Unique - Abcès ou nodules'],
      examinateur_signed_at: '2025-07-07T14:24:20.272Z',
      nombre_d_animaux: 1,
      type: CarcasseType.GROS_GIBIER,
      zacharie_carcasse_id: `${feiNumero}_MM-001-002`,
      svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    },
    {
      fei_numero: feiNumero,
      date_mise_a_mort: '2025-07-07T00:00:00.000Z',
      numero_bracelet: 'MM-001-003',
      espece: 'Pigeons',
      examinateur_signed_at: '2025-07-07T14:24:21.272Z',
      nombre_d_animaux: 10,
      type: CarcasseType.PETIT_GIBIER,
      zacharie_carcasse_id: `${feiNumero}_MM-001-003`,
      svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    },
    {
      fei_numero: feiNumero,
      date_mise_a_mort: '2025-07-07T00:00:00.000Z',
      numero_bracelet: 'MM-001-004',
      espece: 'Daim',
      examinateur_signed_at: '2025-07-07T14:24:22.256Z',
      nombre_d_animaux: 1,
      type: CarcasseType.GROS_GIBIER,
      zacharie_carcasse_id: `${feiNumero}_MM-001-004`,
      svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    },
  ].map((carcasse) => {
    return {
      ...carcasse,
      ...mapFeiFieldsToCarcasse(fei, carcasse as unknown as Carcasse),
    };
  });
}

function mapFeiFieldsToCarcasse(fei: Fei, carcasse: Prisma.CarcasseUncheckedCreateInput) {
  return {
    date_mise_a_mort: fei.date_mise_a_mort,
    consommateur_final_usage_domestique: fei.consommateur_final_usage_domestique,
    heure_mise_a_mort_premiere_carcasse_fei: fei.heure_mise_a_mort_premiere_carcasse,
    heure_evisceration_derniere_carcasse_fei: fei.heure_evisceration_derniere_carcasse,
    heure_mise_a_mort: carcasse.heure_mise_a_mort,
    heure_evisceration: carcasse.heure_evisceration,
    premier_detenteur_depot_type: fei.premier_detenteur_depot_type,
    premier_detenteur_depot_entity_id: fei.premier_detenteur_depot_entity_id,
    premier_detenteur_depot_entity_name_cache: fei.premier_detenteur_depot_entity_name_cache,
    premier_detenteur_depot_ccg_at: fei.premier_detenteur_depot_ccg_at,
    premier_detenteur_transport_type: fei.premier_detenteur_transport_type,
    premier_detenteur_transport_date: fei.premier_detenteur_transport_date,
    premier_detenteur_prochain_detenteur_role_cache: fei.premier_detenteur_prochain_detenteur_role_cache,
    premier_detenteur_prochain_detenteur_id_cache: fei.premier_detenteur_prochain_detenteur_id_cache,
    examinateur_initial_offline: fei.examinateur_initial_offline,
    examinateur_initial_user_id: fei.examinateur_initial_user_id,
    examinateur_initial_approbation_mise_sur_le_marche:
      fei.examinateur_initial_approbation_mise_sur_le_marche,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      fei.examinateur_initial_date_approbation_mise_sur_le_marche,
    premier_detenteur_offline: fei.premier_detenteur_offline,
    premier_detenteur_user_id: fei.premier_detenteur_user_id,
    premier_detenteur_entity_id: fei.premier_detenteur_entity_id,
    premier_detenteur_name_cache: fei.premier_detenteur_name_cache,
    intermediaire_closed_at: fei.intermediaire_closed_at,
    intermediaire_closed_by_user_id: fei.intermediaire_closed_by_user_id,
    intermediaire_closed_by_entity_id: fei.intermediaire_closed_by_entity_id,
    latest_intermediaire_user_id: fei.latest_intermediaire_user_id,
    latest_intermediaire_entity_id: fei.latest_intermediaire_entity_id,
    latest_intermediaire_name_cache: fei.latest_intermediaire_name_cache,
    svi_assigned_at: fei.svi_assigned_at,
    svi_entity_id: fei.svi_entity_id,
    svi_user_id: fei.svi_user_id,
    svi_closed_at: fei.svi_closed_at,
    svi_closed_by_user_id: fei.svi_closed_by_user_id,
    current_owner_user_id: fei.fei_current_owner_user_id,
    current_owner_user_name_cache: fei.fei_current_owner_user_name_cache,
    current_owner_entity_id: fei.fei_current_owner_entity_id,
    current_owner_entity_name_cache: fei.fei_current_owner_entity_name_cache,
    current_owner_role: fei.fei_current_owner_role,
    next_owner_wants_to_sous_traite: fei.fei_next_owner_wants_to_sous_traite,
    next_owner_sous_traite_at: fei.fei_next_owner_sous_traite_at,
    next_owner_sous_traite_by_user_id: fei.fei_next_owner_sous_traite_by_user_id,
    next_owner_sous_traite_by_entity_id: fei.fei_next_owner_sous_traite_by_entity_id,
    next_owner_user_id: fei.fei_next_owner_user_id,
    next_owner_user_name_cache: fei.fei_next_owner_user_name_cache,
    next_owner_entity_id: fei.fei_next_owner_entity_id,
    next_owner_entity_name_cache: fei.fei_next_owner_entity_name_cache,
    next_owner_role: fei.fei_next_owner_role,
    prev_owner_user_id: fei.fei_prev_owner_user_id,
    prev_owner_entity_id: fei.fei_prev_owner_entity_id,
    prev_owner_role: fei.fei_prev_owner_role,
  };
}
