/**
 * Seed Villettes — génération d'activité (FEIs + carcasses + intermédiaires).
 *
 * Pré-requis : le pool d'acteurs doit exister (lancer `npm run seed-villettes-actors`).
 *
 * Garde-fous :
 *  - Env var ZACHARIE_ALLOW_PREPROD_SEED=true requise.
 *  - Les comptes villette@mail.test et svi-villette@mail.test doivent exister.
 *  - Les acteurs seed (seed-chasseur-*, seed-collecteur-*) doivent exister.
 *
 * Usage :
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run seed-villettes -- --yes
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run seed-villettes -- --from 2026-04-19 --to 2026-05-19 --yes
 *   ZACHARIE_ALLOW_PREPROD_SEED=true npm run seed-villettes -- --date 2026-05-19 --yes
 */

import { EntityRelationStatus, EntityRelationType, EntityTypes, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import readline from 'node:readline';
import prisma from '~/prisma';
import {
  ArrivageContext,
  buildBracelet,
  buildCarcasse,
  buildFei,
  buildFeiNumero,
  buildIntermediairesForFei,
  COMMUNES,
  DEPARTEMENTS,
  FeiState,
  pickArrivageState,
  randomChoice,
  randomInt,
} from './seed-villettes-helpers';

const VILLETTES_ETG_EMAIL = 'villette@mail.test';
const VILLETTES_SVI_EMAIL = 'svi-villette@mail.test';

const ARRIVAGES_PER_DAY_MIN = 15;
const ARRIVAGES_PER_DAY_MAX = 20;
const FEIS_PER_ARRIVAGE_MIN = 4;
const FEIS_PER_ARRIVAGE_MAX = 6;
const CARCASSES_PER_ARRIVAGE_MIN = 80;
const CARCASSES_PER_ARRIVAGE_MAX = 100;

// FEIs supplémentaires pour le jour J en état amont (pas encore arrivés à l'ETG)
const TODAY_EARLY_STAGE_FEIS_MIN = 30;
const TODAY_EARLY_STAGE_FEIS_MAX = 50;

// ---------- CLI parsing ----------

interface CliArgs {
  from: dayjs.Dayjs;
  to: dayjs.Dayjs;
  yes: boolean;
}

function parseCli(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (key: string): string | undefined => {
    const found = argv.find((a) => a === `--${key}` || a.startsWith(`--${key}=`));
    if (!found) return undefined;
    if (found.includes('=')) return found.split('=').slice(1).join('=');
    const idx = argv.indexOf(found);
    return argv[idx + 1] && !argv[idx + 1].startsWith('--') ? argv[idx + 1] : '';
  };
  const has = (key: string) => argv.includes(`--${key}`);

  const today = dayjs().startOf('day');
  let from: dayjs.Dayjs;
  let to: dayjs.Dayjs;

  const date = get('date');
  if (date) {
    from = dayjs(date).startOf('day');
    to = from;
  } else {
    const fromArg = get('from');
    const toArg = get('to');
    if (fromArg) from = dayjs(fromArg).startOf('day');
    else from = today.subtract(29, 'day');
    if (toArg) to = dayjs(toArg).startOf('day');
    else to = today;
  }

  if (!from.isValid() || !to.isValid()) {
    throw new Error('Dates invalides. Format attendu : YYYY-MM-DD');
  }
  if (from.isAfter(to)) {
    throw new Error('--from doit être <= --to');
  }

  return { from, to, yes: has('yes') };
}

// ---------- Confirmation prompt ----------

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

// ---------- Lookup Villettes ETG/SVI ----------

async function lookupVillettes(): Promise<ArrivageContext> {
  const etgUser = await prisma.user.findUnique({ where: { email: VILLETTES_ETG_EMAIL } });
  if (!etgUser) {
    throw new Error(`Utilisateur ETG introuvable : ${VILLETTES_ETG_EMAIL}`);
  }
  const etgRelation = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: etgUser.id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      EntityRelatedWithUser: { type: EntityTypes.ETG },
    },
    include: { EntityRelatedWithUser: true },
  });
  if (!etgRelation || !etgRelation.EntityRelatedWithUser) {
    throw new Error(
      `Relation ETG ADMIN/MEMBER pour ${VILLETTES_ETG_EMAIL} introuvable. ` +
        `Vérifie EntityAndUserRelations.status — sans ADMIN/MEMBER, le registre filtre tout.`
    );
  }

  const sviUser = await prisma.user.findUnique({ where: { email: VILLETTES_SVI_EMAIL } });
  if (!sviUser) {
    throw new Error(`Utilisateur SVI introuvable : ${VILLETTES_SVI_EMAIL}`);
  }
  const sviRelation = await prisma.entityAndUserRelations.findFirst({
    where: {
      owner_id: sviUser.id,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      EntityRelatedWithUser: { type: EntityTypes.SVI },
    },
    include: { EntityRelatedWithUser: true },
  });
  if (!sviRelation || !sviRelation.EntityRelatedWithUser) {
    throw new Error(
      `Relation SVI ADMIN/MEMBER pour ${VILLETTES_SVI_EMAIL} introuvable. ` +
        `Vérifie EntityAndUserRelations.status.`
    );
  }

  const etgEntity = etgRelation.EntityRelatedWithUser;
  const sviEntity = sviRelation.EntityRelatedWithUser;
  return {
    etgEntityId: etgEntity.id,
    etgEntityNameCache: etgEntity.nom_d_usage ?? etgEntity.raison_sociale ?? 'ETG Villettes',
    etgUserId: etgUser.id,
    sviEntityId: sviEntity.id,
    sviEntityNameCache: sviEntity.nom_d_usage ?? sviEntity.raison_sociale ?? 'SVI Villettes',
    sviUserId: sviUser.id,
  };
}

// ---------- Load seed actors from DB ----------

interface SeedAssociation {
  entity: { id: string; nom: string };
  departement: string;
  chasseurs: Array<{ id: string; name: string; isCfei: boolean }>;
}

interface SeedCollecteur {
  entity: { id: string; nom: string };
  user: { id: string; name: string };
}

function extractDeptFromCfei(cfei: string | null | undefined): string | null {
  if (!cfei) return null;
  const m = cfei.match(/^CFEI-(\d{2,3})-/);
  return m ? m[1] : null;
}

async function loadSeedActors(): Promise<{
  associations: SeedAssociation[];
  collecteurs: SeedCollecteur[];
}> {
  console.log("📤 Chargement du pool d'acteurs seed depuis la DB...");

  const chasseurs = await prisma.user.findMany({
    where: {
      email: { startsWith: 'seed-chasseur-', endsWith: '@mail.test' },
    },
    include: {
      EntityAndUserRelations: {
        where: { relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY },
        include: { EntityRelatedWithUser: true },
      },
    },
  });

  const assoMap = new Map<string, SeedAssociation>();
  for (const c of chasseurs) {
    const assoRel = c.EntityAndUserRelations.find(
      (r) => r.EntityRelatedWithUser.type === EntityTypes.PREMIER_DETENTEUR
    );
    if (!assoRel) continue;
    const assoEntity = assoRel.EntityRelatedWithUser;
    if (!assoMap.has(assoEntity.id)) {
      const dept = extractDeptFromCfei(c.numero_cfei) ?? randomChoice(DEPARTEMENTS);
      assoMap.set(assoEntity.id, {
        entity: {
          id: assoEntity.id,
          nom: assoEntity.nom_d_usage ?? assoEntity.raison_sociale ?? '',
        },
        departement: dept,
        chasseurs: [],
      });
    }
    assoMap.get(assoEntity.id)!.chasseurs.push({
      id: c.id,
      name: `${c.prenom ?? ''} ${c.nom_de_famille ?? ''}`.trim() || 'Chasseur seed',
      isCfei: c.est_forme_a_l_examen_initial === true,
    });
  }

  const collecteursUsers = await prisma.user.findMany({
    where: {
      email: { startsWith: 'seed-collecteur-', endsWith: '@mail.test' },
    },
    include: {
      EntityAndUserRelations: {
        where: { relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY },
        include: { EntityRelatedWithUser: true },
      },
    },
  });

  const collecteurs: SeedCollecteur[] = [];
  for (const u of collecteursUsers) {
    const collRel = u.EntityAndUserRelations.find(
      (r) => r.EntityRelatedWithUser.type === EntityTypes.COLLECTEUR_PRO
    );
    if (!collRel) continue;
    collecteurs.push({
      entity: {
        id: collRel.EntityRelatedWithUser.id,
        nom: collRel.EntityRelatedWithUser.nom_d_usage ?? collRel.EntityRelatedWithUser.raison_sociale ?? '',
      },
      user: {
        id: u.id,
        name: `${u.prenom ?? ''} ${u.nom_de_famille ?? ''}`.trim() || 'Collecteur seed',
      },
    });
  }

  const associations = Array.from(assoMap.values()).filter((a) => a.chasseurs.length > 0);

  return { associations, collecteurs };
}

// ---------- Génération des arrivages ----------

interface ArrivageGen {
  feis: Prisma.FeiUncheckedCreateInput[];
  carcasses: Prisma.CarcasseUncheckedCreateInput[];
  intermediaires: Prisma.CarcasseIntermediaireUncheckedCreateInput[];
}

function distributeCarcasses(total: number, nbFeis: number): number[] {
  const base = Math.floor(total / nbFeis);
  const arr = new Array(nbFeis).fill(base);
  let remaining = total - base * nbFeis;
  while (remaining > 0) {
    const idx = randomInt(0, nbFeis - 1);
    arr[idx]++;
    remaining--;
  }
  return arr;
}

function generateArrivage(args: {
  arrivageDate: Date;
  daysFromToday: number;
  associations: SeedAssociation[];
  collecteur: SeedCollecteur;
  ctx: ArrivageContext;
  braceletYY: string;
  chasseurBraceletCounters: Map<string, number>;
}): ArrivageGen {
  const { arrivageDate, daysFromToday, associations, collecteur, ctx, braceletYY, chasseurBraceletCounters } =
    args;

  const nbFeis = randomInt(FEIS_PER_ARRIVAGE_MIN, FEIS_PER_ARRIVAGE_MAX);
  const totalCarcasses = randomInt(CARCASSES_PER_ARRIVAGE_MIN, CARCASSES_PER_ARRIVAGE_MAX);
  const carcassesPerFei = distributeCarcasses(totalCarcasses, nbFeis);

  const feis: Prisma.FeiUncheckedCreateInput[] = [];
  const carcasses: Prisma.CarcasseUncheckedCreateInput[] = [];
  const intermediaires: Prisma.CarcasseIntermediaireUncheckedCreateInput[] = [];

  for (let i = 0; i < nbFeis; i++) {
    const asso = randomChoice(associations);
    const cfeiChasseurs = asso.chasseurs.filter((c) => c.isCfei);
    const examinateur = cfeiChasseurs.length > 0 ? randomChoice(cfeiChasseurs) : randomChoice(asso.chasseurs);
    const premierDetenteur =
      asso.chasseurs.length > 1
        ? randomChoice(asso.chasseurs.filter((c) => c.id !== examinateur.id))
        : examinateur;

    const killOffsetDays = randomInt(0, 3);
    const killDate = dayjs(arrivageDate)
      .subtract(killOffsetDays, 'day')
      .hour(randomInt(7, 11))
      .minute(randomInt(0, 59))
      .second(0)
      .toDate();

    const state = pickArrivageState(daysFromToday);

    const numeroDate = dayjs(killDate).add(i, 'second').toDate();
    const numero = buildFeiNumero(examinateur.id, numeroDate);

    const commune = randomChoice(COMMUNES);
    const resumeText = `${carcassesPerFei[i]} carcasses`;

    const fei = buildFei({
      state,
      numero,
      killDate,
      arrivageDate,
      examinateurUser: examinateur,
      premierDetenteurUser: premierDetenteur,
      premierDetenteurEntity: asso.entity,
      collecteurUser: collecteur.user,
      collecteurEntity: collecteur.entity,
      commune,
      resumeText,
      ctx,
    });
    feis.push(fei);

    const feiCarcasses: Prisma.CarcasseUncheckedCreateInput[] = [];
    for (let c = 0; c < carcassesPerFei[i]; c++) {
      const counter = (chasseurBraceletCounters.get(examinateur.id) ?? 0) + 1;
      chasseurBraceletCounters.set(examinateur.id, counter);
      const bracelet = buildBracelet(asso.departement, braceletYY, counter);
      const carcasse = buildCarcasse({
        fei,
        state,
        carcasseIndex: c,
        bracelet,
        killDate,
        arrivageDate,
        ctx,
      });
      feiCarcasses.push(carcasse);
    }
    carcasses.push(...feiCarcasses);

    intermediaires.push(
      ...buildIntermediairesForFei({
        fei,
        carcasses: feiCarcasses,
        state,
        arrivageDate,
        collecteurUser: collecteur.user,
        collecteurEntity: collecteur.entity,
        ctx,
      })
    );
  }

  return { feis, carcasses, intermediaires };
}

function generateEarlyStageFeis(args: {
  associations: SeedAssociation[];
  collecteurs: SeedCollecteur[];
  ctx: ArrivageContext;
  braceletYY: string;
  chasseurBraceletCounters: Map<string, number>;
  today: Date;
}): ArrivageGen {
  const { associations, collecteurs, ctx, braceletYY, chasseurBraceletCounters, today } = args;
  const nb = randomInt(TODAY_EARLY_STAGE_FEIS_MIN, TODAY_EARLY_STAGE_FEIS_MAX);

  const feis: Prisma.FeiUncheckedCreateInput[] = [];
  const carcasses: Prisma.CarcasseUncheckedCreateInput[] = [];
  const intermediaires: Prisma.CarcasseIntermediaireUncheckedCreateInput[] = [];

  for (let i = 0; i < nb; i++) {
    const r = Math.random();
    let state: FeiState;
    if (r < 0.4) state = 'CHASSEUR_EN_COURS';
    else if (r < 0.75) state = 'PREMIER_DETENTEUR_EN_ATTENTE';
    else state = 'TRANSIT_COLLECTEUR';

    const asso = randomChoice(associations);
    const cfeiChasseurs = asso.chasseurs.filter((c) => c.isCfei);
    const examinateur = cfeiChasseurs.length > 0 ? randomChoice(cfeiChasseurs) : randomChoice(asso.chasseurs);
    const premierDetenteur =
      asso.chasseurs.length > 1
        ? randomChoice(asso.chasseurs.filter((c) => c.id !== examinateur.id))
        : examinateur;
    const collecteur = randomChoice(collecteurs);

    const killDate = dayjs(today)
      .subtract(randomInt(0, 2), 'day')
      .hour(randomInt(7, 11))
      .minute(randomInt(0, 59))
      .second(0)
      .toDate();
    const numeroDate = dayjs(killDate).add(i, 'second').toDate();
    const numero = buildFeiNumero(examinateur.id, numeroDate);

    const fei = buildFei({
      state,
      numero,
      killDate,
      arrivageDate: today,
      examinateurUser: examinateur,
      premierDetenteurUser: premierDetenteur,
      premierDetenteurEntity: asso.entity,
      collecteurUser: collecteur.user,
      collecteurEntity: collecteur.entity,
      commune: randomChoice(COMMUNES),
      resumeText: `${randomInt(2, 6)} carcasses`,
      ctx,
    });
    feis.push(fei);

    const nbCarcasses = randomInt(2, 6);
    const feiCarcasses: Prisma.CarcasseUncheckedCreateInput[] = [];
    for (let c = 0; c < nbCarcasses; c++) {
      const counter = (chasseurBraceletCounters.get(examinateur.id) ?? 0) + 1;
      chasseurBraceletCounters.set(examinateur.id, counter);
      const bracelet = buildBracelet(asso.departement, braceletYY, counter);
      feiCarcasses.push(
        buildCarcasse({ fei, state, carcasseIndex: c, bracelet, killDate, arrivageDate: today, ctx })
      );
    }
    carcasses.push(...feiCarcasses);
    intermediaires.push(
      ...buildIntermediairesForFei({
        fei,
        carcasses: feiCarcasses,
        state,
        arrivageDate: today,
        collecteurUser: collecteur.user,
        collecteurEntity: collecteur.entity,
        ctx,
      })
    );
  }

  return { feis, carcasses, intermediaires };
}

// ---------- Insertion par batch ----------

async function insertBatch(gen: ArrivageGen) {
  if (gen.feis.length === 0) return;
  const chunk = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  for (const c of chunk(gen.feis, 500)) await prisma.fei.createMany({ data: c });
  for (const c of chunk(gen.carcasses, 1000)) await prisma.carcasse.createMany({ data: c });
  for (const c of chunk(gen.intermediaires, 1000)) await prisma.carcasseIntermediaire.createMany({ data: c });
}

// ---------- Main ----------

async function main() {
  if (process.env.ZACHARIE_ALLOW_PREPROD_SEED !== 'true') {
    console.error('❌ ZACHARIE_ALLOW_PREPROD_SEED=true requis pour exécuter ce script (garde-fou preprod).');
    process.exit(2);
  }

  const args = parseCli();

  console.log('────────────────────────────────────────────────');
  console.log("🌱 SEED VILLETTES — GÉNÉRATION D'ACTIVITÉ");
  console.log('────────────────────────────────────────────────');
  console.log(`DB         : ${maskDbUrl(process.env.POSTGRESQL_ADDON_URI)}`);
  console.log(`Période    : ${args.from.format('YYYY-MM-DD')} → ${args.to.format('YYYY-MM-DD')}`);
  const nbDays = args.to.diff(args.from, 'day') + 1;
  console.log(`Jours      : ${nbDays}`);
  console.log(
    `Volumétrie : ~${Math.round((ARRIVAGES_PER_DAY_MIN + ARRIVAGES_PER_DAY_MAX) / 2)} arrivages/jour, ~${Math.round((CARCASSES_PER_ARRIVAGE_MIN + CARCASSES_PER_ARRIVAGE_MAX) / 2)} carcasses/arrivage`
  );
  console.log('────────────────────────────────────────────────');

  const ctx = await lookupVillettes();
  console.log(`✅ ETG Villettes  : entity=${ctx.etgEntityId} user=${ctx.etgUserId}`);
  console.log(`✅ SVI Villettes  : entity=${ctx.sviEntityId} user=${ctx.sviUserId}`);

  const { associations, collecteurs } = await loadSeedActors();
  console.log(
    `   Acteurs chargés : ${associations.length} associations (${associations.reduce((s, a) => s + a.chasseurs.length, 0)} chasseurs), ${collecteurs.length} collecteurs`
  );

  if (associations.length === 0 || collecteurs.length === 0) {
    console.error('');
    console.error('❌ Aucun acteur seed trouvé en base.');
    console.error("   Lance d'abord :");
    console.error('     ZACHARIE_ALLOW_PREPROD_SEED=true npm run seed-villettes-actors -- --yes');
    process.exit(1);
  }
  console.log('────────────────────────────────────────────────');

  if (!args.yes) {
    const ok = await confirm("Lancer la génération d'activité ?");
    if (!ok) {
      console.log('Abandon.');
      process.exit(0);
    }
  }

  const braceletYY = dayjs().format('YY');
  const chasseurBraceletCounters = new Map<string, number>();

  let totalFeis = 0;
  let totalCarcasses = 0;
  let totalIntermediaires = 0;

  const today = dayjs().startOf('day');

  for (let d = 0; d < nbDays; d++) {
    const day = args.from.add(d, 'day');
    const daysFromToday = today.diff(day, 'day');

    const nbArrivages = randomInt(ARRIVAGES_PER_DAY_MIN, ARRIVAGES_PER_DAY_MAX);
    console.log(`📅 ${day.format('YYYY-MM-DD')} (J-${daysFromToday}) : ${nbArrivages} arrivages...`);

    let dayFeis = 0;
    let dayCarcasses = 0;
    let dayIntermediaires = 0;

    for (let a = 0; a < nbArrivages; a++) {
      const arrivageDate = day
        .hour(randomInt(6, 18))
        .minute(randomInt(0, 59))
        .second(randomInt(0, 59))
        .toDate();
      const collecteur = randomChoice(collecteurs);
      const gen = generateArrivage({
        arrivageDate,
        daysFromToday,
        associations,
        collecteur,
        ctx,
        braceletYY,
        chasseurBraceletCounters,
      });
      await insertBatch(gen);
      dayFeis += gen.feis.length;
      dayCarcasses += gen.carcasses.length;
      dayIntermediaires += gen.intermediaires.length;
    }

    if (daysFromToday === 0) {
      console.log(`   + génération des FEIs en état amont (chasseur / premier détenteur / transit)...`);
      const earlyGen = generateEarlyStageFeis({
        associations,
        collecteurs,
        ctx,
        braceletYY,
        chasseurBraceletCounters,
        today: day.toDate(),
      });
      await insertBatch(earlyGen);
      dayFeis += earlyGen.feis.length;
      dayCarcasses += earlyGen.carcasses.length;
      dayIntermediaires += earlyGen.intermediaires.length;
    }

    console.log(`   → ${dayFeis} FEIs, ${dayCarcasses} carcasses, ${dayIntermediaires} intermédiaires`);
    totalFeis += dayFeis;
    totalCarcasses += dayCarcasses;
    totalIntermediaires += dayIntermediaires;
  }

  console.log('────────────────────────────────────────────────');
  console.log('✅ Activité générée.');
  console.log(`   FEIs            : ${totalFeis}`);
  console.log(`   Carcasses       : ${totalCarcasses}`);
  console.log(`   Intermédiaires  : ${totalIntermediaires}`);
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
