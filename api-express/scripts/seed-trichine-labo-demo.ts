/**
 * Seed de démonstration pour tester l'import de résultats LIMS (cf doc/trichine-import-lims.md).
 *
 * Crée, sur la base pointée par POSTGRESQL_ADDON_URI :
 *  - une entité LVD + une entité LNR (nécessaire à la génération auto de FTP sur DOUTEUX)
 *  - un utilisateur laboratoire  : labo-demo@example.fr / secret-secret
 *  - un utilisateur émetteur (chasseur), une FEI et 3 carcasses sanglier
 *  - 3 pools (P-26-000001/002/003), 1 échantillon par pool (E-26-000001/002/003)
 *  - une FTP ENVOYEE au LVD contenant les 3 pools
 *
 * Idempotent : nettoie son propre run précédent avant de recréer.
 *
 * Lancer (depuis api-express/) :
 *   tsx ./scripts/seed-trichine-labo-demo.ts
 * ou contre la base de test :
 *   NODE_ENV=test POSTGRESQL_ADDON_URI=postgres://postgres:postgres@localhost:5432/zacharietest tsx ./scripts/seed-trichine-labo-demo.ts
 *
 * NE PAS lancer contre une base partagée (préprod/prod).
 */
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  TrichineSitePrelevement,
  TrichineStatutLogistiqueFTP,
  TrichineType,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import { hashPassword } from '~/service/crypto';

const LVD_ID = 'demo-lvd-entity';
const LNR_ID = 'demo-lnr-entity';
const LABO_USER_ID = 'LABDM';
const EMETTEUR_USER_ID = 'EMTDM';
const LABO_EMAIL = 'labo-demo@example.fr';
const EMETTEUR_EMAIL = 'emetteur-trichine-demo@example.fr';
const FEI_NUMERO = 'ZACH-DEMO-TRICHINE-001';
const FTP_NUMERO = 'F-26-000001';

// pool ↔ carcasse ↔ échantillon, index par index
const ROWS = [
  {
    pool: 'P-26-000001',
    carcasse: 'demo-trichine-carcasse-1',
    bracelet: 'DEMO-001',
    echantillon: 'E-26-000001',
  },
  {
    pool: 'P-26-000002',
    carcasse: 'demo-trichine-carcasse-2',
    bracelet: 'DEMO-002',
    echantillon: 'E-26-000002',
  },
  {
    pool: 'P-26-000003',
    carcasse: 'demo-trichine-carcasse-3',
    bracelet: 'DEMO-003',
    echantillon: 'E-26-000003',
  },
];
const POOL_REFS = ROWS.map((r) => r.pool);
const CARCASSE_IDS = ROWS.map((r) => r.carcasse);
const ECHANTILLON_REFS = ROWS.map((r) => r.echantillon);

async function cleanup() {
  // Ordre enfants → parents
  await prisma.trichinePoolFTP.deleteMany({ where: { TrichinePool: { reference_pool: { in: POOL_REFS } } } });
  await prisma.trichineFTP.deleteMany({
    where: { OR: [{ numero_fiche: FTP_NUMERO }, { destinataire_entity_id: { in: [LVD_ID, LNR_ID] } }] },
  });
  await prisma.trichineEchantillon.deleteMany({ where: { reference_echantillon: { in: ECHANTILLON_REFS } } });
  await prisma.trichinePool.deleteMany({ where: { reference_pool: { in: POOL_REFS } } });
  await prisma.trichineNotification.deleteMany({
    where: { utilisateur_id: { in: [LABO_USER_ID, EMETTEUR_USER_ID] } },
  });
  await prisma.trichineHistoriqueStatut.deleteMany({
    where: { modifie_par_user_id: { in: [LABO_USER_ID, EMETTEUR_USER_ID] } },
  });
  await prisma.carcasse.deleteMany({ where: { zacharie_carcasse_id: { in: CARCASSE_IDS } } });
  await prisma.fei.deleteMany({ where: { numero: FEI_NUMERO } });
  await prisma.entityAndUserRelations.deleteMany({
    where: { owner_id: { in: [LABO_USER_ID, EMETTEUR_USER_ID] } },
  });
  await prisma.password.deleteMany({ where: { user_id: { in: [LABO_USER_ID, EMETTEUR_USER_ID] } } });
  await prisma.user.deleteMany({ where: { id: { in: [LABO_USER_ID, EMETTEUR_USER_ID] } } });
  await prisma.entity.deleteMany({ where: { id: { in: [LVD_ID, LNR_ID] } } });
}

async function main() {
  await cleanup();

  // 1. Entités laboratoire
  await prisma.entity.createMany({
    data: [
      {
        id: LVD_ID,
        raison_sociale: 'LVD de démonstration',
        nom_d_usage: 'LVD Démo',
        type: EntityTypes.LABORATOIRE,
        is_lnr: false,
        zacharie_compatible: true,
        address_ligne_1: '1 rue du Laboratoire',
        code_postal: '75000',
        ville: 'Paris',
      },
      {
        id: LNR_ID,
        raison_sociale: 'LNR de démonstration (ANSES)',
        nom_d_usage: 'LNR Démo',
        type: EntityTypes.LABORATOIRE,
        is_lnr: true,
        zacharie_compatible: true,
        address_ligne_1: '1 avenue du LNR',
        code_postal: '94700',
        ville: 'Maisons-Alfort',
      },
    ],
  });

  // 2. Utilisateurs
  await prisma.user.createMany({
    data: [
      {
        id: LABO_USER_ID,
        email: LABO_EMAIL,
        roles: [UserRoles.LABORATOIRE],
        activated: true,
        activated_at: new Date(),
        prenom: 'Léa',
        nom_de_famille: 'Labo',
        onboarded_at: new Date(),
      },
      {
        id: EMETTEUR_USER_ID,
        email: EMETTEUR_EMAIL,
        roles: [UserRoles.CHASSEUR],
        activated: true,
        activated_at: new Date(),
        prenom: 'Émile',
        nom_de_famille: 'Metteur',
        onboarded_at: new Date(),
      },
    ],
  });

  await prisma.password.createMany({
    data: [
      { user_id: LABO_USER_ID, password: await hashPassword('secret-secret') },
      { user_id: EMETTEUR_USER_ID, password: await hashPassword('secret-secret') },
    ],
  });

  // 3. Rattachement du user labo à l'entité LVD (guardLabo exige ADMIN/MEMBER)
  await prisma.entityAndUserRelations.create({
    data: {
      owner_id: LABO_USER_ID,
      entity_id: LVD_ID,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: EntityRelationStatus.ADMIN,
    },
  });

  // 4. FEI + carcasses sanglier (émetteur = 1er détenteur)
  await prisma.fei.create({
    data: {
      numero: FEI_NUMERO,
      created_by_user_id: EMETTEUR_USER_ID,
      commune_mise_a_mort: 'Paris',
    },
  });
  await prisma.carcasse.createMany({
    data: ROWS.map((row) => ({
      zacharie_carcasse_id: row.carcasse,
      numero_bracelet: row.bracelet,
      fei_numero: FEI_NUMERO,
      espece: 'Sanglier',
      date_mise_a_mort: new Date(),
      premier_detenteur_user_id: EMETTEUR_USER_ID,
      current_owner_user_id: EMETTEUR_USER_ID,
    })),
  });

  // 5. Pools (1 par carcasse)
  await prisma.trichinePool.createMany({
    data: POOL_REFS.map((reference_pool) => ({
      reference_pool,
      cree_par_user_id: EMETTEUR_USER_ID,
      type: TrichineType.INITIAL,
      date_constitution: new Date(),
    })),
  });
  const pools = await prisma.trichinePool.findMany({
    where: { reference_pool: { in: POOL_REFS } },
    select: { id: true, reference_pool: true },
  });
  const poolIdByRef = new Map(pools.map((pool) => [pool.reference_pool, pool.id]));

  // 6. 1 échantillon par carcasse, rattaché à son pool
  await prisma.trichineEchantillon.createMany({
    data: ROWS.map((row) => ({
      reference_echantillon: row.echantillon,
      zacharie_carcasse_id: row.carcasse,
      preleve_par_user_id: EMETTEUR_USER_ID,
      type: TrichineType.INITIAL,
      site_prelevement: TrichineSitePrelevement.PILIER_DIAPHRAGME,
      masse_grammes: 5,
      date_prelevement: new Date(),
      pool_id: poolIdByRef.get(row.pool),
    })),
  });

  // 7. FTP envoyée au LVD, contenant les 3 pools
  const ftp = await prisma.trichineFTP.create({
    data: {
      numero_fiche: FTP_NUMERO,
      expediteur_user_id: EMETTEUR_USER_ID,
      destinataire_entity_id: LVD_ID,
      statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
      date_envoi: new Date(),
    },
  });
  await prisma.trichinePoolFTP.createMany({
    data: pools.map((pool) => ({ pool_id: pool.id, ftp_id: ftp.id })),
  });

  console.info('\n✅ Seed trichine labo démo créé.\n');
  console.info(`   Labo    : ${LABO_EMAIL} / secret-secret  (rôle LABORATOIRE, LVD « LVD Démo »)`);
  console.info(`   FTP     : ${FTP_NUMERO} (ENVOYEE) → LVD`);
  console.info(`   Pools   : ${POOL_REFS.join(', ')}  (1 échantillon / carcasse sanglier chacun)`);
  console.info('\n   Fichier results.csv à uploader dans « Importer des résultats » :\n');
  console.info(
    '   reference_pool;resultat_analyse;date_debut_analyse;date_fin_analyse;reference_labo;commentaire'
  );
  console.info('   P-26-000001;NEGATIF;2026-07-01;2026-07-02;LAB-889;');
  console.info('   P-26-000002;DOUTEUX;2026-07-01;2026-07-02;LAB-890;larve suspectée');
  console.info('   P-26-000099;NEGATIF;;;;   (ligne volontairement introuvable)\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
