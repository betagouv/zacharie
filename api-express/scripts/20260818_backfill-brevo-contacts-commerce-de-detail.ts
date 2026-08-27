/**
 * Backfill Brevo des utilisateurs COMMERCE_DE_DETAIL : crée les contacts manquants et resynchronise
 * les attributs (nom, prénom, rôle, téléphones, adresse) de ceux déjà enregistrés.
 *
 * Deux trous à rattraper :
 * - les partenaires circuit court créés avant le 4 février 2026 (commit f1a7092d) n'ont jamais été
 *   poussés dans Brevo : la route POST /entite/partenaire créait l'entité et l'utilisateur sans
 *   appeler `createBrevoContact` ;
 * - les contacts créés depuis n'ont reçu que CREATED_BY / CREATION DATE / ROLE, et ROLE valait
 *   « Partenaire ». Nom, prénom et coordonnées n'arrivaient qu'au premier `PUT /user/:id`.
 *
 * Usage (dry-run, n'écrit rien) :
 *   cd api-express
 *   POSTGRESQL_ADDON_URI=postgres://... tsx ./scripts/20260818_backfill-brevo-contacts-commerce-de-detail.ts
 *
 * Usage (envoi réel vers Brevo) :
 *   cd api-express
 *   NODE_ENV=production ENVIRONMENT=production BREVO_API=... POSTGRESQL_ADDON_URI=postgres://... \
 *     tsx ./scripts/20260818_backfill-brevo-contacts-commerce-de-detail.ts --apply
 *
 * NODE_ENV/ENVIRONMENT=production sont obligatoires : sinon `DISABLED` est vrai dans
 * `src/third-parties/brevo.ts` et tous les appels Brevo sont court-circuités.
 *
 * Idempotent : `createBrevoContact` récupère l'id d'un contact Brevo déjà existant sur le même email
 * au lieu d'en créer un doublon, et `updateBrevoContact` réécrit les mêmes attributs.
 * `createdBy: 'ADMIN'` évite d'envoyer à contact@zacharie.beta.gouv.fr un mail
 * « Nouvelle ouverture de compte » par utilisateur rattrapé.
 */
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
    // createBrevoContact crée le contact (avec tous ses attributs) et enregistre le brevo_contact_id
    // sur le user. Si un contact Brevo existait déjà sur cet email, il se contente de le rattacher :
    // updateBrevoContact pousse dans tous les cas nom, prénom, rôle, téléphones et adresse.
    const alreadyHadContact = !!user.brevo_contact_id;
    const withContact = alreadyHadContact ? user : await createBrevoContact(user, 'ADMIN');
    if (!withContact.brevo_contact_id) {
      failed++;
      console.log(`❌ ${user.email} — contact non créé (voir Sentry)`);
      continue;
    }
    await updateBrevoContact(withContact);
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
