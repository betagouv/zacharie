/**
 * Seed Villettes — création du pool d'acteurs (chasseurs, associations, collecteurs).
 *
 * Idempotent : si le pool existe déjà (détection via `seed-chasseur-001@mail.test`),
 * exit code 0 sans rien faire. Pour repartir de zéro, lance `npm run cleanup-villettes`.
 *
 * Garde-fous :
 *  - Env var ZACHARIE_ALLOW_PREPROD_SEED=true requise.
 *  - Les comptes villette@mail.test et svi-villette@mail.test doivent exister.
 *
 * Usage :
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run seed-villettes-actors -- --yes
 */

import { EntityRelationStatus, EntityRelationType, EntityTypes, Prisma } from '@prisma/client';
import readline from 'node:readline';
import prisma from '~/prisma';
import { hashPassword } from '~/service/crypto';
import {
  DEPARTEMENTS,
  genShortId,
  makeSeedAssociationEntity,
  makeSeedChasseur,
  makeSeedCollecteurEntity,
  makeSeedCollecteurUser,
  randomChoice,
  randomInt,
} from './seed-villettes-helpers';

const SEED_PASSWORD = 'secret-secret';

const VILLETTES_ETG_EMAIL = 'villette@mail.test';
const VILLETTES_SVI_EMAIL = 'svi-villette@mail.test';

const NB_ASSOCIATIONS = 15;
const NB_CHASSEURS_PER_ASSOCIATION_MIN = 3;
const NB_CHASSEURS_PER_ASSOCIATION_MAX = 5;
const NB_COLLECTEURS = 10;

const SENTINEL_CHASSEUR_EMAIL = 'seed-chasseur-001@mail.test';

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (oui/non) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'oui' || answer.trim().toLowerCase() === 'o');
    });
  });
}

function maskDbUrl(url: string | undefined): string {
  if (!url) return '(non définie)';
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

async function verifyVillettesExist() {
  const etgUser = await prisma.user.findUnique({ where: { email: VILLETTES_ETG_EMAIL } });
  if (!etgUser) {
    throw new Error(`Utilisateur ETG introuvable : ${VILLETTES_ETG_EMAIL}`);
  }
  const sviUser = await prisma.user.findUnique({ where: { email: VILLETTES_SVI_EMAIL } });
  if (!sviUser) {
    throw new Error(`Utilisateur SVI introuvable : ${VILLETTES_SVI_EMAIL}`);
  }
  // Vérifier qu'ils ont bien une entité ETG / SVI rattachée
  const etgRelation = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: etgUser.id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      EntityRelatedWithUser: { type: EntityTypes.ETG },
    },
  });
  if (!etgRelation) {
    throw new Error(`Entité ETG liée à ${VILLETTES_ETG_EMAIL} introuvable`);
  }
  const sviRelation = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: sviUser.id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      EntityRelatedWithUser: { type: EntityTypes.SVI },
    },
  });
  if (!sviRelation) {
    throw new Error(`Entité SVI liée à ${VILLETTES_SVI_EMAIL} introuvable`);
  }
}

async function alreadySeeded(): Promise<boolean> {
  const existing = await prisma.user.findUnique({ where: { email: SENTINEL_CHASSEUR_EMAIL } });
  return existing !== null;
}

async function createSeedActors() {
  console.log('📥 Création des associations de chasse et chasseurs...');

  const associationEntities: Prisma.EntityCreateManyInput[] = [];
  const chasseurUsers: Prisma.UserCreateManyInput[] = [];
  const userEntityRelations: Prisma.EntityAndUserRelationsCreateManyInput[] = [];

  let globalChasseurNum = 0;

  for (let i = 0; i < NB_ASSOCIATIONS; i++) {
    const assoEntity = makeSeedAssociationEntity(i);
    associationEntities.push(assoEntity);

    const departement = randomChoice(DEPARTEMENTS);
    const nbChasseurs = randomInt(NB_CHASSEURS_PER_ASSOCIATION_MIN, NB_CHASSEURS_PER_ASSOCIATION_MAX);

    for (let c = 0; c < nbChasseurs; c++) {
      globalChasseurNum++;
      const userId = genShortId();
      const numeroForEmail = globalChasseurNum;
      // Au moins un CFEI par asso (le premier), ~60% des autres
      const withCfei = c === 0 || Math.random() < 0.6;
      const chasseur = makeSeedChasseur({
        id: userId,
        numero: numeroForEmail,
        associationIndex: i,
        withCfei,
        departement,
      });
      // Email stable (sans suffix de run) → seed-chasseur-001@mail.test
      chasseurUsers.push(chasseur);

      userEntityRelations.push({
        owner_id: userId,
        entity_id: assoEntity.id!,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: c === 0 ? EntityRelationStatus.ADMIN : EntityRelationStatus.MEMBER,
      });
    }
  }

  await prisma.entity.createMany({ data: associationEntities });
  await prisma.user.createMany({ data: chasseurUsers });

  console.log('📥 Création des collecteurs pros...');
  const collecteurEntities: Prisma.EntityCreateManyInput[] = [];
  const collecteurUsers: Prisma.UserCreateManyInput[] = [];

  for (let i = 0; i < NB_COLLECTEURS; i++) {
    const collEntity = makeSeedCollecteurEntity(i);
    collecteurEntities.push(collEntity);

    const userId = genShortId();
    const collUser = makeSeedCollecteurUser({ id: userId, numero: i + 1 });
    collecteurUsers.push(collUser);

    userEntityRelations.push({
      owner_id: userId,
      entity_id: collEntity.id!,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: EntityRelationStatus.ADMIN,
    });
  }

  await prisma.entity.createMany({ data: collecteurEntities });
  await prisma.user.createMany({ data: collecteurUsers });
  await prisma.entityAndUserRelations.createMany({ data: userEntityRelations });

  console.log('🔐 Hash + insertion des mots de passe seed...');
  const hashed = await hashPassword(SEED_PASSWORD);
  const allSeedUserIds = [...chasseurUsers.map((u) => u.id!), ...collecteurUsers.map((u) => u.id!)];
  await prisma.password.createMany({
    data: allSeedUserIds.map((user_id) => ({ user_id, password: hashed })),
  });

  return {
    associations: NB_ASSOCIATIONS,
    chasseurs: chasseurUsers.length,
    collecteurs: collecteurUsers.length,
  };
}

async function main() {
  if (process.env.ZACHARIE_ALLOW_PREPROD_SEED !== 'true') {
    console.error('❌ ZACHARIE_ALLOW_PREPROD_SEED=true requis pour exécuter ce script (garde-fou preprod).');
    process.exit(2);
  }
  const yes = process.argv.includes('--yes');

  console.log('────────────────────────────────────────────────');
  console.log("👤 SEED VILLETTES — POOL D'ACTEURS");
  console.log('────────────────────────────────────────────────');
  console.log(`DB       : ${maskDbUrl(process.env.POSTGRESQL_ADDON_URI)}`);
  console.log(
    `Volume   : ${NB_ASSOCIATIONS} associations, ~${NB_ASSOCIATIONS * 4} chasseurs, ${NB_COLLECTEURS} collecteurs`
  );
  console.log('────────────────────────────────────────────────');

  await verifyVillettesExist();
  console.log(`✅ ETG  ${VILLETTES_ETG_EMAIL} trouvé`);
  console.log(`✅ SVI  ${VILLETTES_SVI_EMAIL} trouvé`);

  if (await alreadySeeded()) {
    console.log('');
    console.log(`ℹ️  ${SENTINEL_CHASSEUR_EMAIL} existe déjà — pool d'acteurs déjà créé.`);
    console.log('   Pour repartir de zéro :');
    console.log('     ZACHARIE_ALLOW_PREPROD_SEED=true npm run cleanup-villettes -- --apply --yes');
    process.exit(0);
  }

  if (!yes) {
    const ok = await confirm("Créer le pool d'acteurs seed ?");
    if (!ok) {
      console.log('Abandon.');
      process.exit(0);
    }
  }

  const stats = await createSeedActors();

  console.log('────────────────────────────────────────────────');
  console.log("✅ Pool d'acteurs créé.");
  console.log(`   Associations   : ${stats.associations}`);
  console.log(`   Chasseurs      : ${stats.chasseurs}  (emails seed-chasseur-NNN@mail.test)`);
  console.log(`   Collecteurs    : ${stats.collecteurs}  (emails seed-collecteur-NN@mail.test)`);
  console.log(`   Mot de passe   : ${SEED_PASSWORD}`);
  console.log('');
  console.log("Étape suivante : générer de l'activité");
  console.log('  ZACHARIE_ALLOW_PREPROD_SEED=true npm run seed-villettes -- --yes');
  console.log('────────────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error('💥 Erreur :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
