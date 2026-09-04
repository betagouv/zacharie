/**
 * Simule la réception d'un rapport d'analyses sur l'adresse de dépôt, sans envoyer de mail
 * et sans passer par Brevo : le fichier est lu sur le disque au lieu d'être téléchargé.
 *
 * Ce qui est réellement exercé : le stockage Cellar, le journal `EmailEntrant`, l'OCR Albert,
 * le rattachement au pool par la référence lue dans le document, et l'application du résultat
 * (avec ses effets de bord : statuts, FTP de confirmation vers le LNR sur un DOUTEUX, notifications).
 *
 * Ce qui ne l'est pas : l'authentification du webhook et la lecture du sujet du message — pour
 * ça, un curl sur POST /webhooks/brevo-inbound suffit (cf doc/emails.md).
 *
 * Prérequis :
 *   1. tsx ./scripts/seed-trichine-labo-demo.ts   (crée le labo, les pools P-26-00000x et la FTP)
 *   2. CELLAR_ADDON_* posées (le document doit être stocké quelque part qu'Albert puisse lire)
 *   3. ALBERT_API_KEY posée (sinon le message reste « À analyser », à relancer depuis l'admin)
 *
 * Lancer (depuis api-express/) :
 *   tsx ./scripts/simuler-mail-entrant-trichine.ts ~/Desktop/rapport.pdf
 *   tsx ./scripts/simuler-mail-entrant-trichine.ts ~/Desktop/rapport.pdf --from labo-demo@example.fr
 *   tsx ./scripts/simuler-mail-entrant-trichine.ts ~/Desktop/rapport.pdf --sans-analyse
 *
 * NE PAS lancer contre une base partagée : le script refuse toute base non locale.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '~/prisma';
import { IS_CELLAR_CONFIGURED } from '~/third-parties/cellar';
import { IS_ALBERT_CONFIGURED } from '~/third-parties/albert';
import { storeTrichineDocumentFromBuffer } from '~/utils/trichine-document-upload';
import { TrichineDocumentSource, TrichineDocumentType } from '~/utils/trichine';
import { EmailEntrantStatut, getSenderLabo } from '~/utils/trichine-inbound-email';
import { analyserEmailsEntrantsEnAttente } from '~/utils/trichine-inbound-ocr';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function lireArgument(nom: string, defaut: string): string {
  const index = process.argv.indexOf(`--${nom}`);
  return index > -1 ? (process.argv[index + 1] ?? defaut) : defaut;
}

function baseEstLocale(): boolean {
  const uri = process.env.POSTGRESQL_ADDON_URI ?? '';
  return uri.includes('localhost') || uri.includes('127.0.0.1');
}

async function main() {
  if (!baseEstLocale()) {
    console.error('Base non locale (POSTGRESQL_ADDON_URI) : le script ne touche que votre base locale.');
    process.exit(1);
  }

  const fichier = process.argv[2];
  if (!fichier || fichier.startsWith('--')) {
    console.error('Usage : tsx ./scripts/simuler-mail-entrant-trichine.ts <chemin-du-fichier> [options]');
    process.exit(1);
  }
  if (!fs.existsSync(fichier)) {
    console.error(`Fichier introuvable : ${fichier}`);
    process.exit(1);
  }
  if (!IS_CELLAR_CONFIGURED) {
    console.error('Cellar non configuré : le document ne peut être ni stocké ni lu par Albert.');
    process.exit(1);
  }

  const contentType = CONTENT_TYPES[path.extname(fichier).toLowerCase()];
  if (!contentType) {
    console.error(`Format non supporté : ${path.extname(fichier)} (PDF, JPEG, PNG ou WEBP attendus)`);
    process.exit(1);
  }

  const expediteur = lireArgument('from', 'labo-demo@example.fr').toLowerCase();
  const sujet = lireArgument('sujet', "Rapport d'analyses");
  const nomFichier = path.basename(fichier);
  const messageId = `<simu-${Date.now()}@local>`;

  const labo = await getSenderLabo(expediteur);
  if (!labo) {
    console.warn(
      `⚠️  ${expediteur} n'est pas un utilisateur LABORATOIRE rattaché à un laboratoire : ` +
        'le document sera stocké mais jamais rattaché. Lancez seed-trichine-labo-demo.ts, ' +
        "ou passez --from avec l'email d'un utilisateur laboratoire existant."
    );
  }

  // Le document est déposé sans rattachement : c'est la lecture de son contenu qui doit le rattacher
  const stored = await storeTrichineDocumentFromBuffer({
    type: TrichineDocumentType.RAPPORT_COFRAC,
    body: fs.readFileSync(fichier),
    contentType,
    userId: null,
    source: TrichineDocumentSource.EMAIL,
    nomFichier,
    email: { message_id: messageId, expediteur, sujet, recu_at: new Date() },
  });
  if (stored.kind === 'error') {
    console.error(`Stockage impossible : ${stored.error}`);
    process.exit(1);
  }
  console.log(`✅ Document stocké : ${stored.document.id} (${stored.document.fichier_url})`);

  await prisma.emailEntrant.create({
    data: {
      message_id: messageId,
      expediteur,
      destinataires: [process.env.TRICHINE_RESULTATS_EMAIL || 'depot@example.fr'],
      sujet,
      recu_at: new Date(),
      nb_pieces_jointes: 1,
      statut: EmailEntrantStatut.A_ANALYSER,
      laboratoire_reconnu: !!labo,
      detail: { simulation: true, stored: 1, attachments: [{ nom_fichier: nomFichier }] },
    },
  });
  console.log(`✅ Message journalisé : ${messageId} (statut À analyser)`);

  if (process.argv.includes('--sans-analyse')) {
    console.log('→ Analyse non lancée (--sans-analyse). Relançable depuis /app/admin/emails-entrants.');
    return;
  }
  if (!IS_ALBERT_CONFIGURED) {
    console.warn(
      "⚠️  ALBERT_API_KEY non posée : pas d'OCR. Le message reste « À analyser », " +
        'relançable depuis /app/admin/emails-entrants une fois la clé en place.'
    );
    return;
  }

  console.log('⏳ Analyse en cours (OCR Albert)…');
  await analyserEmailsEntrantsEnAttente();

  const email = await prisma.emailEntrant.findUnique({ where: { message_id: messageId } });
  const document = await prisma.trichineDocument.findUnique({ where: { id: stored.document.id } });
  const pool = document?.pool_id
    ? await prisma.trichinePool.findUnique({ where: { id: document.pool_id } })
    : null;

  console.log('\n--- Résultat ---');
  console.log(`Statut du message   : ${email?.statut}`);
  console.log(`Texte lu            : ${document?.texte_source ?? 'aucun'}`);
  console.log(`Rattachement        : ${pool?.reference_pool ?? 'aucun'} (${document?.rattachement_source})`);
  console.log(`Résultat du pool    : ${pool?.resultat_analyse ?? 'aucun'}`);
  console.log(`\nDétail : ${JSON.stringify(email?.detail, null, 2)}`);
  console.log('\nÀ voir aussi dans /app/admin/emails-entrants');
  if (document?.texte_extrait) {
    console.log(`\nTexte lu dans le document :\n${document.texte_extrait.slice(0, 1000)}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
