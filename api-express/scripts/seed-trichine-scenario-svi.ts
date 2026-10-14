/**
 * Prépare le jeu de données du scénario de test manuel trichine côté SVI.
 * Protocole de test : `doc/trichine-scenario-test-svi.md`.
 *
 * Crée quatre comptes (SVI, LVD, LNR, chasseur), leurs entités, et une fiche de
 * 22 sangliers assignés au service d'inspection — 22 pour que la répartition
 * automatique en pools produise deux pools (19 + 3) et que les écrans soient
 * regardés avec un volume réaliste.
 *
 * Lancer (depuis api-express/) :
 *   tsx ./scripts/seed-trichine-scenario-svi.ts
 *
 * Idempotent : nettoie son propre run précédent (données préfixées `e2e-trichine`).
 * NE PAS lancer contre une base partagée (préprod / prod).
 */
import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import { hashPassword } from '~/service/crypto';

const MOT_DE_PASSE = 'secret-secret';
const PREFIXE = 'e2e-trichine';
const FEI_NUMERO = `${PREFIXE}-FEI-001`;
const NB_CARCASSES = 22;

const ACTEURS = {
  svi: { id: 'E2ESVI', email: `${PREFIXE}-svi@example.fr`, roles: [UserRoles.SVI] },
  lvd: { id: 'E2ELVD', email: `${PREFIXE}-lvd@example.fr`, roles: [UserRoles.LABORATOIRE] },
  lnr: { id: 'E2ELNR', email: `${PREFIXE}-lnr@example.fr`, roles: [UserRoles.LABORATOIRE] },
  chasseur: { id: 'E2ECHA', email: `${PREFIXE}-chasseur@example.fr`, roles: [UserRoles.CHASSEUR] },
};
const ENTITES = {
  svi: `${PREFIXE}-entity-svi`,
  lvd: `${PREFIXE}-entity-lvd`,
  lnr: `${PREFIXE}-entity-lnr`,
};

async function nettoyer() {
  const carcasseIds = (
    await prisma.carcasse.findMany({
      where: { fei_numero: FEI_NUMERO },
      select: { zacharie_carcasse_id: true },
    })
  ).map((carcasse) => carcasse.zacharie_carcasse_id);

  const echantillons = await prisma.trichineEchantillon.findMany({
    where: { zacharie_carcasse_id: { in: carcasseIds } },
    select: { pool_id: true },
  });
  const poolIds = [...new Set(echantillons.map((e) => e.pool_id).filter(Boolean))] as string[];
  const poolsLies = await prisma.trichinePool.findMany({
    where: { OR: [{ id: { in: poolIds } }, { pool_parent_id: { in: poolIds } }] },
    select: { id: true },
  });
  const tousPools = [...new Set([...poolIds, ...poolsLies.map((pool) => pool.id)])];
  const ftpIds = (
    await prisma.trichinePoolFTP.findMany({
      where: { pool_id: { in: tousPools } },
      select: { ftp_id: true },
    })
  ).map((link) => link.ftp_id);

  await prisma.trichinePoolFTP.deleteMany({ where: { pool_id: { in: tousPools } } });
  await prisma.trichineDocument.deleteMany({
    where: { OR: [{ pool_id: { in: tousPools } }, { ftp_id: { in: ftpIds } }] },
  });
  await prisma.trichineFTP.deleteMany({ where: { id: { in: ftpIds } } });
  await prisma.trichineEchantillon.deleteMany({ where: { zacharie_carcasse_id: { in: carcasseIds } } });
  await prisma.trichinePool.deleteMany({ where: { id: { in: tousPools } } });
  await prisma.trichineHistoriqueStatut.deleteMany({
    where: { objet_id: { in: [...carcasseIds, ...tousPools, ...ftpIds] } },
  });
  await prisma.carcasse.deleteMany({ where: { fei_numero: FEI_NUMERO } });
  await prisma.fei.deleteMany({ where: { numero: FEI_NUMERO } });

  const userIds = Object.values(ACTEURS).map((acteur) => acteur.id);
  await prisma.trichineNotification.deleteMany({ where: { utilisateur_id: { in: userIds } } });
  await prisma.notificationLog.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.entityAndUserRelations.deleteMany({ where: { owner_id: { in: userIds } } });
  await prisma.password.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.entity.deleteMany({ where: { id: { in: Object.values(ENTITES) } } });
}

async function creer() {
  for (const [cle, id] of Object.entries(ENTITES)) {
    await prisma.entity.create({
      data: {
        id,
        type: cle === 'svi' ? EntityTypes.SVI : EntityTypes.LABORATOIRE,
        nom_d_usage: cle === 'svi' ? 'SVI de test' : cle === 'lvd' ? 'LVD 35 de test' : 'ANSES — LNR de test',
        raison_sociale: `${PREFIXE} ${cle}`,
        is_lnr: cle === 'lnr',
        address_ligne_1: '9 rue du Clos Courtel',
        code_postal: '35000',
        ville: 'Rennes',
      },
    });
  }

  for (const [cle, acteur] of Object.entries(ACTEURS)) {
    await prisma.user.create({
      data: {
        id: acteur.id,
        email: acteur.email,
        roles: acteur.roles,
        prenom: 'Test',
        nom_de_famille: cle.toUpperCase(),
        telephone: '0600000000',
        activated: true,
        activated_at: new Date(),
        onboarded_at: new Date(),
        // Le scénario vérifie que les notifications partent : on garde email + push actifs
        notifications: ['EMAIL', 'PUSH'],
      },
    });
    await prisma.password.create({
      data: { user_id: acteur.id, password: await hashPassword(MOT_DE_PASSE) },
    });
  }

  for (const [userId, entityId] of [
    [ACTEURS.svi.id, ENTITES.svi],
    [ACTEURS.lvd.id, ENTITES.lvd],
    [ACTEURS.lnr.id, ENTITES.lnr],
  ] as Array<[string, string]>) {
    await prisma.entityAndUserRelations.create({
      data: {
        owner_id: userId,
        entity_id: entityId,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
    });
  }

  await prisma.fei.create({
    data: {
      numero: FEI_NUMERO,
      date_mise_a_mort: new Date(),
      commune_mise_a_mort: 'Paimpont',
      created_by_user_id: ACTEURS.chasseur.id,
      examinateur_initial_user_id: ACTEURS.chasseur.id,
      premier_detenteur_user_id: ACTEURS.chasseur.id,
    },
  });

  for (let index = 1; index <= NB_CARCASSES; index++) {
    await prisma.carcasse.create({
      data: {
        zacharie_carcasse_id: `${FEI_NUMERO}_BR-${index}`,
        fei_numero: FEI_NUMERO,
        numero_bracelet: `TEST-${String(index).padStart(3, '0')}`,
        espece: 'Sanglier',
        date_mise_a_mort: new Date(),
        examinateur_initial_user_id: ACTEURS.chasseur.id,
        premier_detenteur_user_id: ACTEURS.chasseur.id,
        svi_entity_id: ENTITES.svi,
        svi_assigned_at: new Date(),
      },
    });
  }
}

async function main() {
  await nettoyer();
  await creer();
  console.log(`
Jeu de données du scénario trichine SVI prêt.

  Fiche       ${FEI_NUMERO}
  Carcasses   ${NB_CARCASSES} sangliers (TEST-001 … TEST-0${NB_CARCASSES}) assignés au SVI de test

  SVI         ${ACTEURS.svi.email}
  LVD         ${ACTEURS.lvd.email}
  LNR         ${ACTEURS.lnr.email}
  Chasseur    ${ACTEURS.chasseur.email}

  Mot de passe pour tous : ${MOT_DE_PASSE}

Protocole de test : doc/trichine-scenario-test-svi.md
`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
