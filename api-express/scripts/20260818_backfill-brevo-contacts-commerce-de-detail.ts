import { UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import { createBrevoContact, updateBrevoContact } from '~/third-parties/brevo';
import { IS_DEV_OR_TEST, ENVIRONMENT } from '~/config';

const APPLY = process.argv.includes('--apply');

async function main() {
  const users = await prisma.user.findMany({
    where: {
      roles: { has: UserRoles.COMMERCE_DE_DETAIL },
      deleted_at: null,
      email: { not: null },
    },
    orderBy: { created_at: 'asc' },
  });

  const toCreate = users.filter((user) => !user.brevo_contact_id);
  console.log(
    `${users.length} utilisateur(s) COMMERCE_DE_DETAIL : ${toCreate.length} sans contact Brevo, ${users.length - toCreate.length} à resynchroniser`
  );

  if (!APPLY) {
    for (const user of users) {
      const action = user.brevo_contact_id ? `maj ${user.brevo_contact_id}` : 'création';
      console.log(
        `[dry-run] ${action} — ${user.email} — ${user.prenom ?? ''} ${user.nom_de_famille ?? ''}`.trimEnd()
      );
    }
    console.log('\nDry-run : rien envoyé. Relancer avec --apply.');
    return;
  }

  if (ENVIRONMENT !== 'production' || IS_DEV_OR_TEST) {
    throw new Error(
      'Les appels Brevo sont désactivés hors production : relancer avec NODE_ENV=production ENVIRONMENT=production'
    );
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const user of users) {
    const alreadyHadContact = !!user.brevo_contact_id;
    const withContact = alreadyHadContact ? user : await createBrevoContact(user, 'ADMIN');
    if (!withContact.brevo_contact_id) {
      failed++;
      console.log(`❌ ${user.email} — contact non créé (voir Sentry)`);
      continue;
    }
    await updateBrevoContact(withContact, 'ADMIN');
    if (alreadyHadContact) {
      updated++;
      console.log(`🔄 ${user.email} — contact ${withContact.brevo_contact_id} mis à jour`);
    } else {
      created++;
      console.log(`✅ ${user.email} — contact ${withContact.brevo_contact_id} créé`);
    }
  }

  console.log(`\n${created} contact(s) créé(s), ${updated} mis à jour, ${failed} échec(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
