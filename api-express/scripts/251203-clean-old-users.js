import { PrismaClient } from '@prisma/client';
import readline from 'readline';

// Configuration de la connexion DB
// Vous pouvez soit passer la connexion en variable d'environnement :
// Soit la modifier directement dans ce fichier
const DATABASE_URL = process.env.POSTGRESQL_ADDON_URI;

if (!DATABASE_URL) {
  console.error('❌ Erreur: POSTGRESQL_ADDON_URI doit être défini');
  process.exit(1);
}

// Liste des emails à supprimer - MODIFIEZ CETTE LISTE
const EMAILS_TO_DELETE = [
  // ADD EMAILS TO DELETE HERE
];

if (EMAILS_TO_DELETE.length === 0) {
  console.error('❌ Erreur: La liste EMAILS_TO_DELETE est vide. Ajoutez des emails à supprimer.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

// Interface pour lire les entrées utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function findUserRelations(userId) {
  const relations = {
    password: null,
    userRelationsAsOwner: [],
    userRelationsAsRelated: [],
    entityAndUserRelations: [],
    feisCreated: [],
    feisCurrentUser: [],
    feisPremierDetenteur: [],
    feisExaminateurInitial: [],
    feisSviUser: [],
    feisSviClosedBy: [],
    feisNextUser: [],
    feisSoustraiteByUser: [],
    carcassesIpm1: [],
    carcassesIntermediaire: [],
    notificationLogs: [],
    apiKeyApprovals: [],
    apiKeyLogs: [],
  };

  // Password
  relations.password = await prisma.password.findUnique({
    where: { user_id: userId },
  });

  // UserRelations (en tant que owner)
  relations.userRelationsAsOwner = await prisma.userRelations.findMany({
    where: { owner_id: userId, deleted_at: null },
  });

  // UserRelations (en tant que related)
  relations.userRelationsAsRelated = await prisma.userRelations.findMany({
    where: { related_id: userId, deleted_at: null },
  });

  // EntityAndUserRelations
  relations.entityAndUserRelations = await prisma.entityAndUserRelations.findMany({
    where: { owner_id: userId, deleted_at: null },
  });

  // Feis créés par l'utilisateur
  relations.feisCreated = await prisma.fei.findMany({
    where: { created_by_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Feis où l'utilisateur est current user
  relations.feisCurrentUser = await prisma.fei.findMany({
    where: { fei_current_owner_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Feis où l'utilisateur est premier détenteur
  relations.feisPremierDetenteur = await prisma.fei.findMany({
    where: { premier_detenteur_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Feis où l'utilisateur est examinateur initial
  relations.feisExaminateurInitial = await prisma.fei.findMany({
    where: { examinateur_initial_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Feis où l'utilisateur est SVI user
  relations.feisSviUser = await prisma.fei.findMany({
    where: { svi_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Feis fermés par l'utilisateur (SVI)
  relations.feisSviClosedBy = await prisma.fei.findMany({
    where: { svi_closed_by_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Feis où l'utilisateur est next user
  relations.feisNextUser = await prisma.fei.findMany({
    where: { fei_next_owner_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Feis sous-traités par l'utilisateur
  relations.feisSoustraiteByUser = await prisma.fei.findMany({
    where: { fei_next_owner_sous_traite_by_user_id: userId, deleted_at: null },
    select: { id: true, numero: true },
  });

  // Carcasses avec IPM1 user
  relations.carcassesIpm1 = await prisma.carcasse.findMany({
    where: { svi_ipm1_user_id: userId, deleted_at: null },
    select: { zacharie_carcasse_id: true, numero_bracelet: true, fei_numero: true },
  });

  // Carcasses intermédiaires
  relations.carcassesIntermediaire = await prisma.carcasseIntermediaire.findMany({
    where: { intermediaire_user_id: userId, deleted_at: null },
    select: { intermediaire_id: true, fei_numero: true, zacharie_carcasse_id: true },
  });

  // Notification logs
  relations.notificationLogs = await prisma.notificationLog.findMany({
    where: { user_id: userId, deleted_at: null },
    select: { id: true, type: true, action: true, created_at: true },
  });

  // API Key Approvals
  relations.apiKeyApprovals = await prisma.apiKeyApprovalByUserOrEntity.findMany({
    where: { user_id: userId },
    select: { id: true, api_key_id: true, status: true },
  });

  // API Key Logs
  relations.apiKeyLogs = await prisma.apiKeyLog.findMany({
    where: { user_id: userId },
    select: { id: true, api_key_id: true, action: true, created_at: true },
  });

  return relations;
}

function displayRelations(user, relations) {
  console.log(`\n📋 Relations trouvées pour ${user.email || user.id}:`);
  console.log('─'.repeat(80));

  if (relations.password) {
    console.log(`  ✓ Password: OUI`);
  }

  if (relations.userRelationsAsOwner.length > 0) {
    console.log(`  ✓ UserRelations (en tant que owner): ${relations.userRelationsAsOwner.length}`);
    relations.userRelationsAsOwner.forEach((rel) => {
      console.log(`    - ID: ${rel.id}, Type: ${rel.relation}, Related ID: ${rel.related_id}`);
    });
  }

  if (relations.userRelationsAsRelated.length > 0) {
    console.log(`  ✓ UserRelations (en tant que related): ${relations.userRelationsAsRelated.length}`);
    relations.userRelationsAsRelated.forEach((rel) => {
      console.log(`    - ID: ${rel.id}, Type: ${rel.relation}, Owner ID: ${rel.owner_id}`);
    });
  }

  if (relations.entityAndUserRelations.length > 0) {
    console.log(`  ✓ EntityAndUserRelations: ${relations.entityAndUserRelations.length}`);
    relations.entityAndUserRelations.forEach((rel) => {
      console.log(`    - ID: ${rel.id}, Entity ID: ${rel.entity_id}, Type: ${rel.relation}`);
    });
  }

  if (relations.feisCreated.length > 0) {
    console.log(`  ✓ Feis créés: ${relations.feisCreated.length}`);
    relations.feisCreated.slice(0, 5).forEach((fei) => {
      console.log(`    - FEI ${fei.numero} (ID: ${fei.id})`);
    });
    if (relations.feisCreated.length > 5) {
      console.log(`    ... et ${relations.feisCreated.length - 5} autres`);
    }
  }

  if (relations.feisCurrentUser.length > 0) {
    console.log(`  ✓ Feis (current user): ${relations.feisCurrentUser.length}`);
  }

  if (relations.feisPremierDetenteur.length > 0) {
    console.log(`  ✓ Feis (premier détenteur): ${relations.feisPremierDetenteur.length}`);
  }

  if (relations.feisExaminateurInitial.length > 0) {
    console.log(`  ✓ Feis (examinateur initial): ${relations.feisExaminateurInitial.length}`);
  }

  if (relations.feisSviUser.length > 0) {
    console.log(`  ✓ Feis (SVI user): ${relations.feisSviUser.length}`);
  }

  if (relations.feisSviClosedBy.length > 0) {
    console.log(`  ✓ Feis (SVI closed by): ${relations.feisSviClosedBy.length}`);
  }

  if (relations.feisNextUser.length > 0) {
    console.log(`  ✓ Feis (next user): ${relations.feisNextUser.length}`);
  }

  if (relations.feisSoustraiteByUser.length > 0) {
    console.log(`  ✓ Feis (sous-traités): ${relations.feisSoustraiteByUser.length}`);
  }

  if (relations.carcassesIpm1.length > 0) {
    console.log(`  ✓ Carcasses (IPM1): ${relations.carcassesIpm1.length}`);
  }

  if (relations.carcassesIntermediaire.length > 0) {
    console.log(`  ✓ Carcasses intermédiaires: ${relations.carcassesIntermediaire.length}`);
  }

  if (relations.notificationLogs.length > 0) {
    console.log(`  ✓ Notification logs: ${relations.notificationLogs.length}`);
  }

  if (relations.apiKeyApprovals.length > 0) {
    console.log(`  ✓ API Key Approvals: ${relations.apiKeyApprovals.length}`);
  }

  if (relations.apiKeyLogs.length > 0) {
    console.log(`  ✓ API Key Logs: ${relations.apiKeyLogs.length}`);
  }

  const totalRelations =
    (relations.password ? 1 : 0) +
    relations.userRelationsAsOwner.length +
    relations.userRelationsAsRelated.length +
    relations.entityAndUserRelations.length +
    relations.feisCreated.length +
    relations.feisCurrentUser.length +
    relations.feisPremierDetenteur.length +
    relations.feisExaminateurInitial.length +
    relations.feisSviUser.length +
    relations.feisSviClosedBy.length +
    relations.feisNextUser.length +
    relations.feisSoustraiteByUser.length +
    relations.carcassesIpm1.length +
    relations.carcassesIntermediaire.length +
    relations.notificationLogs.length +
    relations.apiKeyApprovals.length +
    relations.apiKeyLogs.length;

  if (totalRelations === 0) {
    console.log(`  ℹ️  Aucune relation trouvée`);
  } else {
    console.log(`\n  📊 Total: ${totalRelations} relation(s)`);
  }
}

async function deleteUser(userId) {
  // La suppression de l'utilisateur devrait automatiquement supprimer les relations
  // grâce aux cascades définies dans le schéma Prisma
  // Mais on vérifie quand même avant de supprimer
  await prisma.user.delete({
    where: { id: userId },
  });
}

async function main() {
  try {
    console.log('🔍 Connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connecté à la base de données\n');

    console.log(`📧 Recherche de ${EMAILS_TO_DELETE.length} utilisateur(s)...\n`);

    const users = await prisma.user.findMany({
      where: {
        email: { in: EMAILS_TO_DELETE },
        deleted_at: null,
      },
    });

    if (users.length === 0) {
      console.log('⚠️  Aucun utilisateur trouvé avec ces emails.');
      return;
    }

    console.log(`✅ ${users.length} utilisateur(s) trouvé(s):\n`);
    users.forEach((user) => {
      console.log(`  - ${user.email || 'Sans email'} (ID: ${user.id})`);
    });

    // Afficher toutes les relations
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VÉRIFICATION DES RELATIONS');
    console.log('='.repeat(80));

    const allRelations = [];
    for (const user of users) {
      const relations = await findUserRelations(user.id);
      allRelations.push({ user, relations });
      displayRelations(user, relations);
    }

    // Demander confirmation
    console.log('\n' + '='.repeat(80));
    console.log(
      '⚠️  ATTENTION: Cette action va supprimer définitivement les utilisateurs et leurs relations'
    );
    console.log('='.repeat(80));

    const answer = await question('\n❓ Voulez-vous continuer avec la suppression? (oui/non): ');

    if (answer.toLowerCase() !== 'oui' && answer.toLowerCase() !== 'o') {
      console.log('\n❌ Suppression annulée.');
      return;
    }

    // Supprimer les utilisateurs
    console.log('\n🗑️  Suppression en cours...\n');

    for (const { user, relations } of allRelations) {
      try {
        await deleteUser(user.id);
        console.log(`✅ Utilisateur supprimé: ${user.email || user.id}`);
      } catch (error) {
        console.error(`❌ Erreur lors de la suppression de ${user.email || user.id}:`, error.message);
      }
    }

    console.log('\n✅ Suppression terminée!');
  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();
