import {
  CarcasseStatus,
  CarcasseType,
  DepotType,
  FeiOwnerRole,
  IPM1Decision,
  IPM1Protocole,
  IPM2Decision,
  IPM2Traitement,
  Prisma,
  TransportType,
  UserRoles,
} from '@prisma/client';
import dayjs from 'dayjs';
import ShortUniqueId from 'short-unique-id';

const idGen = new ShortUniqueId({ length: 5, dictionary: 'alphanum_upper' });

export const SEED_EMAIL_PREFIX = 'seed-';
export const SEED_EMAIL_DOMAIN = '@mail.test';
export const SEED_ENTITY_PREFIX = 'SEED - ';

// Échantillon de communes (codePostal NOM_COMMUNE) — réparties sur quelques départements
// pour donner un côté réaliste sans imposer de cohérence stricte association/dép.
export const COMMUNES = [
  '07200 AUBENAS',
  '07150 VALLON-PONT-D-ARC',
  '07100 ANNONAY',
  '26000 VALENCE',
  '26200 MONTELIMAR',
  '26100 ROMANS-SUR-ISERE',
  '38000 GRENOBLE',
  '38200 VIENNE',
  '69001 LYON',
  '69100 VILLEURBANNE',
  '42000 SAINT-ETIENNE',
  '42100 SAINT-ETIENNE',
  '01000 BOURG-EN-BRESSE',
  '01100 OYONNAX',
  '73000 CHAMBERY',
  '73100 AIX-LES-BAINS',
  '74000 ANNECY',
  '03500 SAINT-POURCAIN-SUR-SIOULE',
  '03100 MONTLUCON',
  '63000 CLERMONT-FERRAND',
];

// Codes département cohérents avec les communes ci-dessus (1–2 par association).
export const DEPARTEMENTS = ['07', '26', '38', '69', '42', '01', '73', '74', '03', '63'];

export const ESPECES_GROS_GIBIER_CERVIDES = ['Cerf', 'Biche', 'Chevreuil', 'Daim'];
export const ESPECE_SANGLIER = 'Sanglier';

// Anomalies réalistes — sous-ensemble de la liste produit.
export const ANOMALIES_CARCASSE = [
  'Souillures (poils, sang, ingesta, contenu digestif)',
  'Plaie de tir',
  'Hématome',
  'Fracture',
  'Abcès',
  'Lésion parasitaire localisée',
];
export const ANOMALIES_ABATS = [
  'Abcès ou nodules Unique - Appareil respiratoire (sinus/trachée/poumon)',
  'Lésion parasitaire — foie',
  'Lésion parasitaire — poumons',
  'Aspect anormal — rate',
  'Aspect anormal — reins',
];

export const PRENOMS = [
  'Marie',
  'Pierre',
  'Sophie',
  'Jean',
  'Catherine',
  'Michel',
  'Claire',
  'Philippe',
  'Anne',
  'François',
  'Isabelle',
  'Nicolas',
  'Julie',
  'Thomas',
  'Christine',
  'Bernard',
  'Patrick',
  'Sylvie',
  'Daniel',
  'Martine',
];

export const NOMS = [
  'Martin',
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Lefebvre',
  'Michel',
  'Garcia',
  'David',
  'Bertrand',
  'Roux',
  'Vincent',
  'Fournier',
];

export const ASSOCIATION_BASE_NAMES = [
  'ACCA des Bois',
  'Association de chasse du Plateau',
  'Société de chasse Saint-Hubert',
  'ACCA de la Vallée',
  'Diane des Trois-Vallées',
  'Société de chasse du Coteau',
  'ACCA des Roches',
  'Chasse communale de la Forêt',
  'ACCA des Vignes',
  'Diane du Mont',
  'ACCA du Lac',
  'Société de chasse des Hauts-Bois',
  'ACCA de la Combe',
  'Chasse communale du Causse',
  'ACCA des Prés',
];

export const COLLECTEUR_BASE_NAMES = [
  'Transports Venaison Express',
  'Viande des Côteaux',
  'TransGibier',
  'Gibier Logistique',
  'Vénerie Transport',
  'Trans-Forêt',
  'Cervidé Express',
  'GTM Gibier',
  'Logivenaison',
  'Pic-Vert Transports',
];

// -------- random helpers --------

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomChance(probability: number) {
  return Math.random() < probability;
}

export function pickEspece(): { espece: string; type: CarcasseType } {
  // 75% sanglier, 25% cervidés
  if (randomChance(0.75)) {
    return { espece: ESPECE_SANGLIER, type: CarcasseType.GROS_GIBIER };
  }
  return { espece: randomChoice(ESPECES_GROS_GIBIER_CERVIDES), type: CarcasseType.GROS_GIBIER };
}

export function genShortId(): string {
  return idGen.randomUUID();
}

export function fullName(prenom: string, nom: string) {
  return `${prenom} ${nom}`;
}

// -------- FEI numero / bracelet helpers --------

export function buildFeiNumero(creatorUserId: string, when: Date): string {
  const d = dayjs(when);
  return `ZACH-${d.format('YYYYMMDD')}-${creatorUserId}-${d.format('HHmmss')}`;
}

export function buildBracelet(departementCode: string, yy: string, n: number): string {
  return `${departementCode}-${yy}-${String(n).padStart(3, '0')}`;
}

// -------- mapping FEI fields → Carcasse (mirror de populate-test-db.ts) --------

type FeiInput = Prisma.FeiUncheckedCreateInput;

export function mapFeiFieldsToCarcasse(fei: FeiInput) {
  return {
    consommateur_final_usage_domestique: fei.consommateur_final_usage_domestique ?? null,
    heure_mise_a_mort_premiere_carcasse_fei: fei.heure_mise_a_mort_premiere_carcasse ?? null,
    heure_evisceration_derniere_carcasse_fei: fei.heure_evisceration_derniere_carcasse ?? null,
    premier_detenteur_depot_type: fei.premier_detenteur_depot_type ?? null,
    premier_detenteur_depot_entity_id: fei.premier_detenteur_depot_entity_id ?? null,
    premier_detenteur_depot_entity_name_cache: fei.premier_detenteur_depot_entity_name_cache ?? null,
    premier_detenteur_depot_ccg_at: fei.premier_detenteur_depot_ccg_at ?? null,
    premier_detenteur_transport_type: fei.premier_detenteur_transport_type ?? null,
    premier_detenteur_transport_date: fei.premier_detenteur_transport_date ?? null,
    premier_detenteur_prochain_detenteur_role_cache:
      fei.premier_detenteur_prochain_detenteur_role_cache ?? null,
    premier_detenteur_prochain_detenteur_id_cache: fei.premier_detenteur_prochain_detenteur_id_cache ?? null,
    examinateur_initial_offline: fei.examinateur_initial_offline ?? null,
    examinateur_initial_user_id: fei.examinateur_initial_user_id ?? null,
    examinateur_initial_approbation_mise_sur_le_marche:
      fei.examinateur_initial_approbation_mise_sur_le_marche ?? null,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      fei.examinateur_initial_date_approbation_mise_sur_le_marche ?? null,
    premier_detenteur_offline: fei.premier_detenteur_offline ?? null,
    premier_detenteur_user_id: fei.premier_detenteur_user_id ?? null,
    premier_detenteur_entity_id: fei.premier_detenteur_entity_id ?? null,
    premier_detenteur_name_cache: fei.premier_detenteur_name_cache ?? null,
    intermediaire_closed_at: fei.intermediaire_closed_at ?? null,
    intermediaire_closed_by_user_id: fei.intermediaire_closed_by_user_id ?? null,
    intermediaire_closed_by_entity_id: fei.intermediaire_closed_by_entity_id ?? null,
    latest_intermediaire_user_id: fei.latest_intermediaire_user_id ?? null,
    latest_intermediaire_entity_id: fei.latest_intermediaire_entity_id ?? null,
    latest_intermediaire_name_cache: fei.latest_intermediaire_name_cache ?? null,
    svi_assigned_at: fei.svi_assigned_at ?? null,
    svi_entity_id: fei.svi_entity_id ?? null,
    svi_user_id: fei.svi_user_id ?? null,
    svi_closed_at: fei.svi_closed_at ?? null,
    svi_closed_by_user_id: fei.svi_closed_by_user_id ?? null,
    current_owner_user_id: fei.fei_current_owner_user_id ?? null,
    current_owner_user_name_cache: fei.fei_current_owner_user_name_cache ?? null,
    current_owner_entity_id: fei.fei_current_owner_entity_id ?? null,
    current_owner_entity_name_cache: fei.fei_current_owner_entity_name_cache ?? null,
    current_owner_role: fei.fei_current_owner_role ?? null,
    next_owner_wants_to_sous_traite: fei.fei_next_owner_wants_to_sous_traite ?? null,
    next_owner_sous_traite_at: fei.fei_next_owner_sous_traite_at ?? null,
    next_owner_sous_traite_by_user_id: fei.fei_next_owner_sous_traite_by_user_id ?? null,
    next_owner_sous_traite_by_entity_id: fei.fei_next_owner_sous_traite_by_entity_id ?? null,
    next_owner_user_id: fei.fei_next_owner_user_id ?? null,
    next_owner_user_name_cache: fei.fei_next_owner_user_name_cache ?? null,
    next_owner_entity_id: fei.fei_next_owner_entity_id ?? null,
    next_owner_entity_name_cache: fei.fei_next_owner_entity_name_cache ?? null,
    next_owner_role: fei.fei_next_owner_role ?? null,
    prev_owner_user_id: fei.fei_prev_owner_user_id ?? null,
    prev_owner_entity_id: fei.fei_prev_owner_entity_id ?? null,
    prev_owner_role: fei.fei_prev_owner_role ?? null,
  };
}

// -------- États fonctionnels d'une FEI à générer --------

export type FeiState =
  // Avant arrivage à l'ETG
  | 'CHASSEUR_EN_COURS' // examinateur n'a pas encore signé
  | 'PREMIER_DETENTEUR_EN_ATTENTE' // examinateur signé, en attente premier détenteur
  | 'TRANSIT_COLLECTEUR' // collecteur a pris en charge, pas encore à l'ETG
  // À l'ETG
  | 'ETG_RECEPTION' // arrivée à l'ETG, pas encore SVI
  | 'SVI_EN_COURS' // SVI assigné, IPM1 partiellement rempli
  // Clôturée
  | 'SVI_CLOSED'; // SVI a clôturé, IPM1 complet

export interface ArrivageContext {
  // Référence Villettes — déjà existants en preprod
  etgEntityId: string;
  etgEntityNameCache: string;
  etgUserId: string;
  sviEntityId: string;
  sviEntityNameCache: string;
  sviUserId: string;
}

export interface FeiBuildInput {
  state: FeiState;
  numero: string;
  killDate: Date; // date_mise_a_mort
  arrivageDate: Date; // when collecteur dropped at ETG
  examinateurUser: { id: string; name: string };
  premierDetenteurUser: { id: string; name: string };
  premierDetenteurEntity: { id: string; nom: string };
  collecteurUser: { id: string; name: string };
  collecteurEntity: { id: string; nom: string };
  commune: string;
  resumeText: string;
  ctx: ArrivageContext;
}

export function buildFei(input: FeiBuildInput): Prisma.FeiUncheckedCreateInput {
  const {
    state,
    numero,
    killDate,
    arrivageDate,
    examinateurUser,
    premierDetenteurUser,
    premierDetenteurEntity,
    collecteurUser,
    collecteurEntity,
    commune,
    resumeText,
    ctx,
  } = input;

  const examinateurSignedAt = dayjs(killDate).add(randomInt(2, 8), 'hour').toDate();
  const premierDetenteurTransportDate = dayjs(killDate).add(randomInt(8, 24), 'hour').toDate();

  // base commune à toutes les FEIs (examinateur + premier détenteur existent toujours)
  const base: Prisma.FeiUncheckedCreateInput = {
    numero,
    date_mise_a_mort: dayjs(killDate).startOf('day').toDate(),
    commune_mise_a_mort: commune,
    heure_mise_a_mort_premiere_carcasse: dayjs(killDate).add(randomInt(7, 11), 'hour').format('HH:mm'),
    heure_evisceration_derniere_carcasse: dayjs(killDate).add(randomInt(12, 17), 'hour').format('HH:mm'),
    created_by_user_id: examinateurUser.id,
    creation_context: 'zacharie',
    resume_nombre_de_carcasses: resumeText,
    examinateur_initial_user_id: examinateurUser.id,
    created_at: examinateurSignedAt,
  };

  if (state === 'CHASSEUR_EN_COURS') {
    return {
      ...base,
      fei_current_owner_user_id: examinateurUser.id,
      fei_current_owner_user_name_cache: examinateurUser.name,
      fei_current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
    };
  }

  // À partir d'ici, l'examinateur a signé
  const baseWithExamSigned: Prisma.FeiUncheckedCreateInput = {
    ...base,
    examinateur_initial_approbation_mise_sur_le_marche: true,
    examinateur_initial_date_approbation_mise_sur_le_marche: examinateurSignedAt,
  };

  if (state === 'PREMIER_DETENTEUR_EN_ATTENTE') {
    return {
      ...baseWithExamSigned,
      fei_current_owner_user_id: premierDetenteurUser.id,
      fei_current_owner_user_name_cache: premierDetenteurUser.name,
      fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      fei_next_owner_user_id: premierDetenteurUser.id,
      fei_next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      fei_next_owner_user_name_cache: premierDetenteurUser.name,
      fei_prev_owner_user_id: examinateurUser.id,
      fei_prev_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
    };
  }

  // À partir d'ici, premier détenteur a validé et la fiche a été transmise au collecteur
  const baseWithPDValidated: Prisma.FeiUncheckedCreateInput = {
    ...baseWithExamSigned,
    premier_detenteur_user_id: premierDetenteurUser.id,
    premier_detenteur_entity_id: premierDetenteurEntity.id,
    premier_detenteur_name_cache: premierDetenteurUser.name,
    premier_detenteur_depot_type: DepotType.ETG,
    premier_detenteur_transport_type: TransportType.COLLECTEUR_PRO,
    premier_detenteur_transport_date: premierDetenteurTransportDate,
    premier_detenteur_prochain_detenteur_id_cache: ctx.etgEntityId,
    premier_detenteur_prochain_detenteur_role_cache: FeiOwnerRole.ETG,
    fei_prev_owner_user_id: examinateurUser.id,
    fei_prev_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
  };

  if (state === 'TRANSIT_COLLECTEUR') {
    const priseEnCharge = dayjs(arrivageDate).subtract(randomInt(1, 5), 'hour').toDate();
    return {
      ...baseWithPDValidated,
      fei_current_owner_user_id: collecteurUser.id,
      fei_current_owner_user_name_cache: collecteurUser.name,
      fei_current_owner_entity_id: collecteurEntity.id,
      fei_current_owner_entity_name_cache: collecteurEntity.nom,
      fei_current_owner_role: FeiOwnerRole.COLLECTEUR_PRO,
      fei_next_owner_entity_id: ctx.etgEntityId,
      fei_next_owner_entity_name_cache: ctx.etgEntityNameCache,
      fei_next_owner_role: FeiOwnerRole.ETG,
      latest_intermediaire_user_id: collecteurUser.id,
      latest_intermediaire_entity_id: collecteurEntity.id,
      latest_intermediaire_name_cache: collecteurEntity.nom,
    };
  }

  // À partir d'ici, l'ETG a réceptionné
  const etgReceptionAt = arrivageDate;
  const baseWithEtgReception: Prisma.FeiUncheckedCreateInput = {
    ...baseWithPDValidated,
    latest_intermediaire_user_id: ctx.etgUserId,
    latest_intermediaire_entity_id: ctx.etgEntityId,
    latest_intermediaire_name_cache: ctx.etgEntityNameCache,
  };

  if (state === 'ETG_RECEPTION') {
    return {
      ...baseWithEtgReception,
      fei_current_owner_entity_id: ctx.etgEntityId,
      fei_current_owner_entity_name_cache: ctx.etgEntityNameCache,
      fei_current_owner_role: FeiOwnerRole.ETG,
      fei_prev_owner_user_id: premierDetenteurUser.id,
      fei_prev_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
    };
  }

  // SVI assigné
  const sviAssignedAt = dayjs(etgReceptionAt).add(randomInt(1, 8), 'hour').toDate();
  const baseWithSviAssigned: Prisma.FeiUncheckedCreateInput = {
    ...baseWithEtgReception,
    fei_current_owner_entity_id: ctx.sviEntityId,
    fei_current_owner_entity_name_cache: ctx.sviEntityNameCache,
    fei_current_owner_role: FeiOwnerRole.SVI,
    fei_prev_owner_entity_id: ctx.etgEntityId,
    fei_prev_owner_role: FeiOwnerRole.ETG,
    svi_assigned_at: sviAssignedAt,
    svi_entity_id: ctx.sviEntityId,
    svi_user_id: ctx.sviUserId,
  };

  if (state === 'SVI_EN_COURS') {
    return baseWithSviAssigned;
  }

  // SVI_CLOSED
  const sviClosedAt = dayjs(sviAssignedAt).add(randomInt(2, 24), 'hour').toDate();
  return {
    ...baseWithSviAssigned,
    svi_closed_at: sviClosedAt,
    svi_closed_by_user_id: ctx.sviUserId,
  };
}

// -------- Carcasses --------

export interface CarcasseBuildInput {
  fei: Prisma.FeiUncheckedCreateInput;
  state: FeiState;
  carcasseIndex: number; // 0-based within the FEI
  bracelet: string;
  killDate: Date;
  arrivageDate: Date; // référence pour calculer l'intermediaire_id ETG (doit matcher buildIntermediairesForFei)
  ctx: ArrivageContext;
}

// Formules déterministes des intermediaire_id (doivent matcher buildIntermediairesForFei).
// Le frontend retrouve le CarcasseIntermediaire via `fei_numero_zacharie_carcasse_id_intermediaire_id`.
export function getCollecteurPriseEnChargeAt(arrivageDate: Date): Date {
  return dayjs(arrivageDate).subtract(2, 'hour').toDate();
}

export function getCollecteurIntermediaireId(
  collecteurUserId: string,
  feiNumero: string,
  arrivageDate: Date
): string {
  const at = getCollecteurPriseEnChargeAt(arrivageDate);
  return `${collecteurUserId}_${feiNumero}_${dayjs(at).format('HHmmss')}`;
}

export function getEtgIntermediaireId(etgUserId: string, feiNumero: string, arrivageDate: Date): string {
  return `${etgUserId}_${feiNumero}_${dayjs(arrivageDate).format('HHmmss')}`;
}

export function buildCarcasse(input: CarcasseBuildInput): Prisma.CarcasseUncheckedCreateInput {
  const { fei, state, bracelet, killDate, arrivageDate, ctx } = input;
  const feiNumero = fei.numero;
  const zacharieCarcasseId = `${feiNumero}_${bracelet}`;
  const { espece, type } = pickEspece();

  const heureMort = dayjs(killDate).add(randomInt(7, 11), 'hour').format('HH:mm');
  const heureEvisc = dayjs(killDate).add(randomInt(12, 17), 'hour').format('HH:mm');

  // ~30% des carcasses ont une anomalie (réaliste mais pas systématique)
  const hasAnomalie = randomChance(0.3);
  const anomaliesCarcasse = hasAnomalie && randomChance(0.5) ? [randomChoice(ANOMALIES_CARCASSE)] : [];
  const anomaliesAbats = hasAnomalie && randomChance(0.5) ? [randomChoice(ANOMALIES_ABATS)] : [];
  const sansAnomalie = anomaliesCarcasse.length === 0 && anomaliesAbats.length === 0;

  const examinateurSignedAt = dayjs(killDate).add(randomInt(2, 8), 'hour').toDate();

  const base: Prisma.CarcasseUncheckedCreateInput = {
    zacharie_carcasse_id: zacharieCarcasseId,
    numero_bracelet: bracelet,
    fei_numero: feiNumero,
    date_mise_a_mort: dayjs(killDate).startOf('day').toDate(),
    espece,
    type,
    nombre_d_animaux: 1,
    heure_mise_a_mort: heureMort,
    heure_evisceration: heureEvisc,
    examinateur_carcasse_sans_anomalie: state === 'CHASSEUR_EN_COURS' ? null : sansAnomalie,
    examinateur_anomalies_carcasse: state === 'CHASSEUR_EN_COURS' ? [] : anomaliesCarcasse,
    examinateur_anomalies_abats: state === 'CHASSEUR_EN_COURS' ? [] : anomaliesAbats,
    examinateur_signed_at: state === 'CHASSEUR_EN_COURS' ? null : examinateurSignedAt,
    created_at: examinateurSignedAt,
    ...mapFeiFieldsToCarcasse(fei),
  };

  if (state === 'CHASSEUR_EN_COURS' || state === 'PREMIER_DETENTEUR_EN_ATTENTE') {
    return { ...base, svi_carcasse_status: CarcasseStatus.SANS_DECISION };
  }

  // En transit chez le collecteur : pas encore de décision (la décision se fait à l'arrivée ETG).
  if (state === 'TRANSIT_COLLECTEUR') {
    return { ...base, svi_carcasse_status: CarcasseStatus.SANS_DECISION };
  }

  // À l'ETG : ~3% manquante, ~2% refus. On doit pointer vers le CarcasseIntermediaire ETG
  // sinon le frontend (useCarcasseStatusAndRefus) plante au render.
  const isManquante = randomChance(0.03);
  const isRefus = !isManquante && randomChance(0.02);

  if (state === 'ETG_RECEPTION') {
    const etgIntermediaireId =
      isManquante || isRefus ? getEtgIntermediaireId(ctx.etgUserId, feiNumero, arrivageDate) : null;
    return {
      ...base,
      svi_carcasse_status: isManquante
        ? CarcasseStatus.MANQUANTE_ETG_COLLECTEUR
        : isRefus
          ? CarcasseStatus.REFUS_ETG_COLLECTEUR
          : CarcasseStatus.SANS_DECISION,
      intermediaire_carcasse_manquante: isManquante ? true : null,
      intermediaire_carcasse_refus_intermediaire_id: etgIntermediaireId,
      intermediaire_carcasse_refus_motif: isRefus ? randomChoice(ANOMALIES_CARCASSE) : null,
    };
  }

  // SVI_EN_COURS : ~50% des carcasses ont leur IPM1 rempli
  if (state === 'SVI_EN_COURS') {
    const ipm1Done = randomChance(0.5);
    if (!ipm1Done) {
      return { ...base, svi_carcasse_status: CarcasseStatus.SANS_DECISION };
    }
    const decision = randomChance(0.85) ? IPM1Decision.ACCEPTE : IPM1Decision.MISE_EN_CONSIGNE;
    const status = decision === IPM1Decision.ACCEPTE ? CarcasseStatus.ACCEPTE : CarcasseStatus.CONSIGNE;
    const ipm1Date = dayjs(fei.svi_assigned_at as Date)
      .add(randomInt(1, 8), 'hour')
      .toDate();
    return {
      ...base,
      svi_assigned_at: fei.svi_assigned_at as Date,
      svi_ipm1_date: ipm1Date,
      svi_ipm1_user_id: ctx.sviUserId,
      svi_ipm1_protocole: IPM1Protocole.STANDARD,
      svi_ipm1_decision: decision,
      svi_ipm1_signed_at: ipm1Date,
      svi_ipm1_nombre_animaux: 1,
      svi_carcasse_status: status,
      svi_carcasse_status_set_at: ipm1Date,
    };
  }

  // SVI_CLOSED : 100% des carcasses ont IPM1, et celles consignées ont IPM2
  // Distribution : 85% ACCEPTE, 10% CONSIGNE→IPM2 (LEVEE_DE_CONSIGNE/SAISIE/TRAITEMENT), 5% directement SAISIE_TOTALE via IPM1 puis IPM2
  const ipm1Date = dayjs(fei.svi_assigned_at as Date)
    .add(randomInt(1, 8), 'hour')
    .toDate();

  const roll = Math.random();
  if (roll < 0.85) {
    // ACCEPTE direct
    return {
      ...base,
      svi_assigned_at: fei.svi_assigned_at as Date,
      svi_ipm1_date: ipm1Date,
      svi_ipm1_user_id: ctx.sviUserId,
      svi_ipm1_protocole: IPM1Protocole.STANDARD,
      svi_ipm1_decision: IPM1Decision.ACCEPTE,
      svi_ipm1_signed_at: ipm1Date,
      svi_ipm1_nombre_animaux: 1,
      svi_carcasse_status: CarcasseStatus.ACCEPTE,
      svi_carcasse_status_set_at: ipm1Date,
    };
  }
  // CONSIGNE → IPM2
  const ipm2Date = dayjs(ipm1Date).add(randomInt(4, 48), 'hour').toDate();
  const ipm2Roll = Math.random();
  let ipm2Decision: IPM2Decision;
  let finalStatus: CarcasseStatus;
  let traitements: IPM2Traitement[] = [];
  if (ipm2Roll < 0.5) {
    ipm2Decision = IPM2Decision.LEVEE_DE_LA_CONSIGNE;
    finalStatus = CarcasseStatus.LEVEE_DE_CONSIGNE;
  } else if (ipm2Roll < 0.75) {
    ipm2Decision = IPM2Decision.SAISIE_TOTALE;
    finalStatus = CarcasseStatus.SAISIE_TOTALE;
  } else if (ipm2Roll < 0.9) {
    ipm2Decision = IPM2Decision.SAISIE_PARTIELLE;
    finalStatus = CarcasseStatus.SAISIE_PARTIELLE;
  } else {
    ipm2Decision = IPM2Decision.TRAITEMENT_ASSAINISSANT;
    finalStatus = CarcasseStatus.TRAITEMENT_ASSAINISSANT;
    traitements = [randomChoice([IPM2Traitement.CUISSON, IPM2Traitement.CONGELATION])];
  }
  return {
    ...base,
    svi_assigned_at: fei.svi_assigned_at as Date,
    svi_ipm1_date: ipm1Date,
    svi_ipm1_user_id: ctx.sviUserId,
    svi_ipm1_protocole: IPM1Protocole.STANDARD,
    svi_ipm1_decision: IPM1Decision.MISE_EN_CONSIGNE,
    svi_ipm1_duree_consigne: randomInt(24, 96),
    svi_ipm1_signed_at: ipm1Date,
    svi_ipm1_nombre_animaux: 1,
    svi_ipm2_date: ipm2Date,
    svi_ipm2_user_id: ctx.sviUserId,
    svi_ipm2_decision: ipm2Decision,
    svi_ipm2_traitement_assainissant: traitements,
    svi_ipm2_signed_at: ipm2Date,
    svi_ipm2_nombre_animaux: 1,
    svi_carcasse_status: finalStatus,
    svi_carcasse_status_set_at: ipm2Date,
  };
}

// -------- CarcasseIntermediaire --------

export function buildIntermediairesForFei(args: {
  fei: Prisma.FeiUncheckedCreateInput;
  carcasses: Prisma.CarcasseUncheckedCreateInput[];
  state: FeiState;
  arrivageDate: Date;
  collecteurUser: { id: string };
  collecteurEntity: { id: string };
  ctx: ArrivageContext;
}): Prisma.CarcasseIntermediaireUncheckedCreateInput[] {
  const { fei, carcasses, state, arrivageDate, collecteurUser, collecteurEntity, ctx } = args;
  if (state === 'CHASSEUR_EN_COURS' || state === 'PREMIER_DETENTEUR_EN_ATTENTE') {
    return [];
  }

  const collecteurPriseAt = getCollecteurPriseEnChargeAt(arrivageDate);
  const collecteurIntermediaireId = getCollecteurIntermediaireId(collecteurUser.id, fei.numero, arrivageDate);

  const collecteurRows: Prisma.CarcasseIntermediaireUncheckedCreateInput[] = carcasses.map((c) => ({
    fei_numero: fei.numero,
    numero_bracelet: c.numero_bracelet,
    zacharie_carcasse_id: c.zacharie_carcasse_id!,
    intermediaire_id: collecteurIntermediaireId,
    intermediaire_entity_id: collecteurEntity.id,
    intermediaire_user_id: collecteurUser.id,
    intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
    intermediaire_prochain_detenteur_role_cache: FeiOwnerRole.ETG,
    intermediaire_prochain_detenteur_id_cache: ctx.etgEntityId,
    prise_en_charge: true,
    prise_en_charge_at: collecteurPriseAt,
    decision_at: collecteurPriseAt,
    created_at: collecteurPriseAt,
  }));

  if (state === 'TRANSIT_COLLECTEUR') {
    return collecteurRows;
  }

  // ETG reception : créer 1 intermediaire ETG par carcasse
  const etgIntermediaireId = getEtgIntermediaireId(ctx.etgUserId, fei.numero, arrivageDate);
  const etgRows: Prisma.CarcasseIntermediaireUncheckedCreateInput[] = carcasses.map((c) => ({
    fei_numero: fei.numero,
    numero_bracelet: c.numero_bracelet,
    zacharie_carcasse_id: c.zacharie_carcasse_id!,
    intermediaire_id: etgIntermediaireId,
    intermediaire_entity_id: ctx.etgEntityId,
    intermediaire_user_id: ctx.etgUserId,
    intermediaire_role: FeiOwnerRole.ETG,
    prise_en_charge: c.intermediaire_carcasse_manquante ? false : true,
    manquante: (c.intermediaire_carcasse_manquante as boolean | null | undefined) ?? null,
    refus: (c.intermediaire_carcasse_refus_motif as string | null | undefined) ?? null,
    prise_en_charge_at: arrivageDate,
    decision_at: arrivageDate,
    created_at: arrivageDate,
  }));

  return [...collecteurRows, ...etgRows];
}

// -------- Seed user / entity factories --------

export function makeSeedAssociationEntity(index: number): Prisma.EntityCreateManyInput & { id: string } {
  const id = crypto.randomUUID();
  const baseName = ASSOCIATION_BASE_NAMES[index % ASSOCIATION_BASE_NAMES.length];
  return {
    id,
    raison_sociale: `${SEED_ENTITY_PREFIX}${baseName} #${index + 1}`,
    nom_d_usage: `${SEED_ENTITY_PREFIX}${baseName} #${index + 1}`,
    type: 'PREMIER_DETENTEUR',
    zacharie_compatible: true,
    code_postal: '00000',
    ville: 'SEED',
    siret: null,
    address_ligne_1: '1 rue du seed',
  };
}

export function makeSeedCollecteurEntity(index: number): Prisma.EntityCreateManyInput & { id: string } {
  const id = crypto.randomUUID();
  const baseName = COLLECTEUR_BASE_NAMES[index % COLLECTEUR_BASE_NAMES.length];
  return {
    id,
    raison_sociale: `${SEED_ENTITY_PREFIX}${baseName} #${index + 1}`,
    nom_d_usage: `${SEED_ENTITY_PREFIX}${baseName} #${index + 1}`,
    type: 'COLLECTEUR_PRO',
    zacharie_compatible: true,
    siret: null,
    code_postal: '00000',
    ville: 'SEED',
    address_ligne_1: '1 rue du seed',
  };
}

export function makeSeedChasseur(args: {
  id: string;
  numero: number; // global seed numbering
  associationIndex: number;
  withCfei: boolean;
  departement: string;
}): Prisma.UserCreateManyInput {
  const { id, numero, associationIndex, withCfei, departement } = args;
  const prenom = randomChoice(PRENOMS);
  const nom = randomChoice(NOMS);
  return {
    id,
    email: `${SEED_EMAIL_PREFIX}chasseur-${String(numero).padStart(3, '0')}${SEED_EMAIL_DOMAIN}`,
    roles: [UserRoles.CHASSEUR],
    activated: true,
    activated_at: new Date(),
    onboarded_at: new Date(),
    prenom,
    nom_de_famille: nom,
    addresse_ligne_1: `${randomInt(1, 50)} chemin de la chasse`,
    code_postal: `${departement}000`,
    ville: 'SEED',
    telephone: `06${String(randomInt(10000000, 99999999))}`,
    est_forme_a_l_examen_initial: withCfei,
    numero_cfei: withCfei ? `CFEI-${departement}-25-${String(numero).padStart(3, '0')}` : null,
    prochain_bracelet_a_utiliser: 1,
  };
}

export function makeSeedCollecteurUser(args: { id: string; numero: number }): Prisma.UserCreateManyInput {
  const { id, numero } = args;
  const prenom = randomChoice(PRENOMS);
  const nom = randomChoice(NOMS);
  return {
    id,
    email: `${SEED_EMAIL_PREFIX}collecteur-${String(numero).padStart(2, '0')}${SEED_EMAIL_DOMAIN}`,
    roles: [UserRoles.COLLECTEUR_PRO],
    activated: true,
    activated_at: new Date(),
    onboarded_at: new Date(),
    prenom,
    nom_de_famille: nom,
    addresse_ligne_1: `${randomInt(1, 50)} avenue des transporteurs`,
    code_postal: '00000',
    ville: 'SEED',
    telephone: `06${String(randomInt(10000000, 99999999))}`,
  };
}

// -------- Résumé volumes --------

export interface DailyDistribution {
  // Quand l'arrivage a lieu à daysFromToday jours dans le passé (0 = aujourd'hui),
  // retourne les proportions d'états pour les FEIs de cet arrivage.
  closed: number;
  sviEnCours: number;
  etgReception: number;
  transitCollecteur: number;
}

export function stateMixForDay(daysFromToday: number): DailyDistribution {
  if (daysFromToday >= 3) {
    return { closed: 1, sviEnCours: 0, etgReception: 0, transitCollecteur: 0 };
  }
  if (daysFromToday === 2) {
    return { closed: 0.9, sviEnCours: 0.1, etgReception: 0, transitCollecteur: 0 };
  }
  if (daysFromToday === 1) {
    return { closed: 0.6, sviEnCours: 0.3, etgReception: 0.1, transitCollecteur: 0 };
  }
  // day 0 (today)
  return { closed: 0, sviEnCours: 0.4, etgReception: 0.4, transitCollecteur: 0.2 };
}

export function pickArrivageState(daysFromToday: number): FeiState {
  const mix = stateMixForDay(daysFromToday);
  const r = Math.random();
  if (r < mix.closed) return 'SVI_CLOSED';
  if (r < mix.closed + mix.sviEnCours) return 'SVI_EN_COURS';
  if (r < mix.closed + mix.sviEnCours + mix.etgReception) return 'ETG_RECEPTION';
  return 'TRANSIT_COLLECTEUR';
}
