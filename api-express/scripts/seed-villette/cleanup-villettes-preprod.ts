/**
 * Cleanup Villettes preprod : supprime les données seed identifiables.
 *
 * Deux modes :
 *  - **Sans flag (défaut)** : supprime tout — users seed (cascade FEIs/carcasses/intermédiaires)
 *    et entités seed (associations + collecteurs).
 *  - **`--keep-actors`** : supprime uniquement les FEIs créées par les seed users
 *    (cascade carcasses + intermédiaires). Conserve users et entités seed → permet de
 *    relancer `seed-villettes` sur le même pool.
 *
 * Garde-fous :
 *  - ZACHARIE_ALLOW_PREPROD_SEED=true requis.
 *  - Dry-run par défaut. Utiliser `--apply` pour exécuter.
 *  - Plafonds quantitatifs : refuse si > 1 000 users / > 10 000 FEIs / > 100 000 carcasses.
 *  - Ne supprime JAMAIS villette@mail.test, svi-villette@mail.test, ni leurs entités.
 *
 * Usage :
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run cleanup-villettes                              # dry-run, tout
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run cleanup-villettes -- --apply --yes             # apply, tout
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run cleanup-villettes -- --keep-actors             # dry-run, activité seulement
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run cleanup-villettes -- --keep-actors --apply --yes
 */

import readline from 'node:readline';
import prisma from '~/prisma';

const SEED_ENTITY_PREFIX = 'SEED - ';

const MAX_USERS_SAFETY = 1000;
const MAX_FEIS_SAFETY = 10000;
const MAX_CARCASSES_SAFETY = 100000;

const PROTECTED_EMAILS = ['villette@mail.test', 'svi-villette@mail.test'];

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

async function main() {
  if (process.env.ZACHARIE_ALLOW_PREPROD_SEED !== 'true') {
    console.error('❌ ZACHARIE_ALLOW_PREPROD_SEED=true requis pour exécuter ce script.');
    process.exit(2);
  }
  const apply = process.argv.includes('--apply');
  const yes = process.argv.includes('--yes');
  const keepActors = process.argv.includes('--keep-actors');

  console.log('────────────────────────────────────────────────');
  console.log('🧹 CLEANUP VILLETTES PREPROD');
  console.log('────────────────────────────────────────────────');
  console.log(`DB    : ${maskDbUrl(process.env.POSTGRESQL_ADDON_URI)}`);
  console.log(`Mode  : ${apply ? 'APPLY (suppression effective)' : 'DRY-RUN (rien ne sera supprimé)'}`);
  console.log(
    `Scope : ${keepActors ? '--keep-actors → wipe activité, conserve users/entités seed' : 'TOUT (users + entités + activité)'}`
  );
  console.log('────────────────────────────────────────────────');

  for (const email of PROTECTED_EMAILS) {
    if (email.startsWith('seed-') && email.endsWith('@mail.test')) {
      throw new Error(`Conflit : email protégé ${email} matche le pattern seed-`);
    }
  }

  const seedUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'seed-', endsWith: '@mail.test' } },
    select: { id: true, email: true },
  });
  const seedUserIds = seedUsers.map((u) => u.id);

  for (const u of seedUsers) {
    if (PROTECTED_EMAILS.includes(u.email ?? '')) {
      throw new Error(`💥 Email protégé ${u.email} matche le pattern seed — ABORT.`);
    }
  }

  const seedEntities = await prisma.entity.findMany({
    where: { raison_sociale: { startsWith: SEED_ENTITY_PREFIX } },
    select: { id: true, raison_sociale: true, type: true },
  });
  const seedEntityIds = seedEntities.map((e) => e.id);

  const feiFilter = {
    OR: [
      { created_by_user_id: { in: seedUserIds.length > 0 ? seedUserIds : ['__noop__'] } },
      { examinateur_initial_user_id: { in: seedUserIds.length > 0 ? seedUserIds : ['__noop__'] } },
    ],
  };

  const feiCount = await prisma.fei.count({ where: feiFilter });
  const carcasseCount = await prisma.carcasse.count({ where: { Fei: feiFilter } });

  console.log('🔎 Inventaire seed :');
  console.log(`   Users seed     : ${seedUsers.length}`);
  console.log(`   Entités seed   : ${seedEntities.length}`);
  console.log(`   FEIs           : ${feiCount}`);
  console.log(`   Carcasses      : ${carcasseCount}`);
  console.log('────────────────────────────────────────────────');

  if (seedUsers.length === 0 && seedEntities.length === 0 && feiCount === 0) {
    console.log('Rien à nettoyer.');
    process.exit(0);
  }

  if (seedUsers.length > MAX_USERS_SAFETY) {
    throw new Error(
      `💥 ${seedUsers.length} users seed trouvés (> ${MAX_USERS_SAFETY}). Refus de supprimer — inspecte manuellement.`
    );
  }
  if (feiCount > MAX_FEIS_SAFETY) {
    throw new Error(`💥 ${feiCount} FEIs à supprimer (> ${MAX_FEIS_SAFETY}). Refus — inspecte manuellement.`);
  }
  if (carcasseCount > MAX_CARCASSES_SAFETY) {
    throw new Error(
      `💥 ${carcasseCount} carcasses à supprimer (> ${MAX_CARCASSES_SAFETY}). Refus — inspecte manuellement.`
    );
  }

  const dangerEntities = seedEntities.filter((e) => e.type === 'ETG' || e.type === 'SVI');
  if (dangerEntities.length > 0) {
    throw new Error(
      `💥 Entité(s) seed de type ETG ou SVI détectée(s) : ${dangerEntities
        .map((e) => `${e.id}/${e.raison_sociale}`)
        .join(', ')}. Refus de supprimer.`
    );
  }

  if (!apply) {
    console.log('🟡 DRY-RUN — relance avec --apply pour exécuter.');
    process.exit(0);
  }

  if (!yes) {
    const action = keepActors
      ? `Confirmer la suppression de ${feiCount} FEIs + ${carcasseCount} carcasses (users/entités seed conservés) ?`
      : `Confirmer la suppression de ${seedUsers.length} users, ${seedEntities.length} entités, ${feiCount} FEIs, ${carcasseCount} carcasses ?`;
    const ok = await confirm(action);
    if (!ok) {
      console.log('Abandon.');
      process.exit(0);
    }
  }

  console.log('🧨 Suppression en cours...');

  // 1) Récupérer les fei_numeros concernés (utile pour purger les logs liés)
  const feisToDelete = await prisma.fei.findMany({
    where: feiFilter,
    select: { numero: true },
  });
  const feiNumeros = feisToDelete.map((f) => f.numero);

  // 2) Supprimer les logs liés aux seed (users + fei_numeros)
  const deletedLogs = await prisma.log.deleteMany({
    where: {
      OR: [
        { user_id: { in: seedUserIds.length > 0 ? seedUserIds : ['__noop__'] } },
        { fei_numero: { in: feiNumeros.length > 0 ? feiNumeros : ['__noop__'] } },
      ],
    },
  });
  console.log(`   Logs supprimés : ${deletedLogs.count}`);

  if (keepActors) {
    // 3a) Mode keep-actors : supprimer uniquement les FEIs (cascade carcasses + intermédiaires)
    const deletedFeis = await prisma.fei.deleteMany({ where: feiFilter });
    console.log(`   FEIs supprimées (cascade carcasses + intermédiaires) : ${deletedFeis.count}`);
    console.log('   Users/Entités seed CONSERVÉS.');
  } else {
    // 3b) Mode complet : supprimer users (cascade FEIs/carcasses/intermédiaires) puis entités seed
    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { in: seedUserIds.length > 0 ? seedUserIds : ['__noop__'] } },
    });
    console.log(`   Users supprimés (cascade FEIs/carcasses/intermédiaires) : ${deletedUsers.count}`);

    const deletedEntities = await prisma.entity.deleteMany({
      where: { id: { in: seedEntityIds.length > 0 ? seedEntityIds : ['__noop__'] } },
    });
    console.log(`   Entités supprimées : ${deletedEntities.count}`);
  }

  console.log('✅ Cleanup terminé.');
}

main()
  .catch((err) => {
    console.error('💥 Erreur :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
