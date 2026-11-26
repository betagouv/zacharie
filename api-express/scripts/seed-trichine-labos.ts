import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import { hashPassword } from '~/service/crypto';

const LVD_ENTITY_ID = 'trichine-seed-lvd-test';
const LNR_ENTITY_ID = 'trichine-seed-lnr-anses';

async function upsertLabo({
  id,
  raisonSociale,
  ville,
  codePostal,
  isLnr,
}: {
  id: string;
  raisonSociale: string;
  ville: string;
  codePostal: string;
  isLnr: boolean;
}) {
  return prisma.entity.upsert({
    where: { id },
    update: { is_lnr: isLnr },
    create: {
      id,
      raison_sociale: raisonSociale,
      nom_d_usage: raisonSociale,
      type: EntityTypes.LABORATOIRE,
      is_lnr: isLnr,
      address_ligne_1: '1 rue du Laboratoire',
      code_postal: codePostal,
      ville,
      for_testing: true,
    },
  });
}

async function upsertLaboUser({
  id,
  email,
  prenom,
  nom,
  entityId,
}: {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  entityId: string;
}) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { roles: [UserRoles.LABORATOIRE], activated: true },
    create: {
      id,
      email,
      prenom,
      nom_de_famille: nom,
      roles: [UserRoles.LABORATOIRE],
      activated: true,
      activated_at: new Date(),
    },
  });
  const existingPassword = await prisma.password.findFirst({ where: { user_id: user.id } });
  if (!existingPassword) {
    await prisma.password.create({
      data: { user_id: user.id, password: await hashPassword('secret-secret') },
    });
  }
  const existingRelation = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: user.id,
      entity_id: entityId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      deleted_at: null,
    },
  });
  if (!existingRelation) {
    await prisma.entityAndUserRelations.create({
      data: {
        owner_id: user.id,
        entity_id: entityId,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
    });
  }
  return user;
}

async function main() {
  const lvd = await upsertLabo({
    id: LVD_ENTITY_ID,
    raisonSociale: 'LVD Test — Laboratoire vétérinaire départemental',
    ville: 'Lyon',
    codePostal: '69007',
    isLnr: false,
  });
  console.log(`✓ LVD : ${lvd.raison_sociale} (${lvd.id})`);

  const lnr = await upsertLabo({
    id: LNR_ENTITY_ID,
    raisonSociale: 'ANSES — Laboratoire National de Référence Trichine',
    ville: 'Maisons-Alfort',
    codePostal: '94700',
    isLnr: true,
  });
  console.log(`✓ LNR : ${lnr.raison_sociale} (${lnr.id})`);

  const lvdUser = await upsertLaboUser({
    id: 'LVD01',
    email: 'lvd@example.fr',
    prenom: 'Laure',
    nom: 'Vétérinaire',
    entityId: lvd.id,
  });
  console.log(`✓ Utilisateur LVD : ${lvdUser.email} (mot de passe : secret-secret)`);

  const lnrUser = await upsertLaboUser({
    id: 'LNR01',
    email: 'lnr@example.fr',
    prenom: 'Nicolas',
    nom: 'Référent',
    entityId: lnr.id,
  });
  console.log(`✓ Utilisateur LNR : ${lnrUser.email} (mot de passe : secret-secret)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
