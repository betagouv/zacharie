import {
  CarcasseStatus,
  CarcasseType,
  DepotType,
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  Prisma,
  TransportType,
  User,
  UserRelationType,
  UserRoles,
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

  await prisma.user.deleteMany();
  await prisma.password.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.entityAndUserRelations.deleteMany();
  await prisma.userRelations.deleteMany();
  await prisma.fei.deleteMany();
  await prisma.carcasse.deleteMany();
  await prisma.carcasseIntermediaire.deleteMany();
  await prisma.log.deleteMany();

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
        email: 'etg-1@example.fr',
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
        email: 'etg-2@example.fr',
        roles: [UserRoles.ETG],
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
      },
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
    ],
  });
  console.log('Entity and user relations created for test', entityAndUserRelations.count);

  const etgAndEntityRelations = await prisma.eTGAndEntityRelations.createMany({
    data: [
      {
        etg_id: entities.find((entity) => entity.raison_sociale === 'ETG 1')?.id,
        entity_type: EntityTypes.COLLECTEUR_PRO,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Collecteur Pro 1')?.id,
      },
      {
        etg_id: entities.find((entity) => entity.raison_sociale === 'ETG 1')?.id,
        entity_type: EntityTypes.SVI,
        entity_id: entities.find((entity) => entity.raison_sociale === 'SVI 1')?.id,
      },
      {
        etg_id: entities.find((entity) => entity.raison_sociale === 'ETG 2')?.id,
        entity_type: EntityTypes.COLLECTEUR_PRO,
        entity_id: entities.find((entity) => entity.raison_sociale === 'Collecteur Pro 2')?.id,
      },
      {
        etg_id: entities.find((entity) => entity.raison_sociale === 'ETG 2')?.id,
        entity_type: EntityTypes.SVI,
        entity_id: entities.find((entity) => entity.raison_sociale === 'SVI 2')?.id,
      },
    ],
  });
  console.log('ETG and entity relations created for test', etgAndEntityRelations.count);

  if (role) {
    if (role === FeiOwnerRole.EXAMINATEUR_INITIAL) {
      await prisma.fei.createMany({
        data: [],
      });
      console.log('Fei created for test for examinateur initial', feiValidatedByExaminateur.numero);
    }
    if (role === FeiOwnerRole.PREMIER_DETENTEUR) {
      await prisma.fei.createMany({
        data: [feiValidatedByExaminateur],
      });
      console.log('Fei created for test for premier detenteur', feiValidatedByPremierDetenteur.numero);
      const carcasses = await prisma.carcasse.createMany({
        data: [
          ...getCarcasses(feiValidatedByExaminateur.numero),
          // ...getCarcasses(feiValidatedByPremierDetenteur.numero),
        ],
      });
      console.log('Carcasses created for test for examinateur initial', carcasses.count);
    }
    if (role === FeiOwnerRole.ETG) {
      await prisma.fei.createMany({
        data: [feiValidatedByPremierDetenteur],
      });
      console.log('Fei created for test for etg', feiValidatedByExaminateur.numero);
      const carcasses = await prisma.carcasse.createMany({
        data: [
          // ...getCarcasses(feiValidatedByExaminateur.numero),
          ...getCarcasses(feiValidatedByPremierDetenteur.numero),
        ],
      });
      console.log('Carcasses created for test for etg', carcasses.count);
    }
  }

  console.log('Database populated successfully');
}

const withRole = process.argv.find((arg) => arg.includes('--role'));
if (withRole) {
  console.log('Populate db with role', withRole?.split('=')[1]);
  populateDb(withRole?.split('=')[1] as FeiOwnerRole);
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

function getCarcasses(feiNumero: string): Array<Prisma.CarcasseUncheckedCreateInput> {
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
  ];
}
