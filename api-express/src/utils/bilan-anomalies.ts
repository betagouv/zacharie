import dayjs from 'dayjs';
import { CarcasseStatus, CarcasseType, FeiOwnerRole, Prisma } from '@prisma/client';
import prisma from '~/prisma';
import { extractDepartementFromCommune } from '~/utils/federation-stats';
import type { BilanAnomaliesLigne, BilanAnomaliesData } from '~/types/responses';

// Bilan des anomalies de fin de saison demandé par la DGAL aux SVI (calque "bilan des anomalies"),
// pré-rempli avec les données Zacharie : une ligne par ETG et par groupe d'espèces du calque.

// Groupes d'espèces du calque DGAL, dans l'ordre du calque.
export const BILAN_GROUPES_ESPECES = [
  'Cerf',
  'Chevreuil',
  'Sanglier',
  'Daim',
  'Petits ruminants sauvages',
  'Petit gibier à plumes',
  'Petit gibier à poils',
] as const;
type BilanGroupeEspece = (typeof BILAN_GROUPES_ESPECES)[number];

const groupeByEspece: Record<string, BilanGroupeEspece> = {
  'Cerf élaphe': 'Cerf',
  'Cerf sika': 'Cerf',
  Chevreuil: 'Chevreuil',
  Sanglier: 'Sanglier',
  Daim: 'Daim',
  Chamois: 'Petits ruminants sauvages',
  Isard: 'Petits ruminants sauvages',
  'Mouflon méditerranéen': 'Petits ruminants sauvages',
  Canards: 'Petit gibier à plumes',
  'Faisans de chasse': 'Petit gibier à plumes',
  Perdrix: 'Petit gibier à plumes',
  Pigeons: 'Petit gibier à plumes',
  'Autres oiseaux': 'Petit gibier à plumes',
  Lapins: 'Petit gibier à poils',
  Lièvres: 'Petit gibier à poils',
  'Autres petits gibiers à poils': 'Petit gibier à poils',
};

// Chapitre II du calque (anomalies examen initial) : seules ces deux anomalies sont tracées dans Zacharie.
const MOTIFS_EI_NON_VALIDE = [
  "Viandes provenant d'une carcasse dont l'examen initial n'est pas valide",
  "Viandes provenant d'un lot de carcasses dont l'examen initial n'est pas valide",
];
const MOTIFS_EI_NON_IDENTIFIEE = [
  "Viandes provenant d'une carcasse non identifiée",
  "Viandes provenant d'un lot de carcasses non identifié",
];

// Une colonne par motif relevé dans le bilan, les plus fréquents en premier.
export function getColonnesAnomalies(lignes: Array<BilanAnomaliesLigne>): Array<string> {
  const totalByMotif = new Map<string, number>();
  for (const ligne of lignes) {
    for (const [motif, count] of Object.entries(ligne.anomalies)) {
      totalByMotif.set(motif, (totalByMotif.get(motif) ?? 0) + count);
    }
  }
  return [...totalByMotif.entries()]
    .sort(([motifA, a], [motifB, b]) => b - a || motifA.localeCompare(motifB, 'fr'))
    .map(([motif]) => motif);
}

// Une saison de chasse va du 1er juin (année N) au 31 mai (année N+1), identifiée par N.
export function getSaisonBounds(saison: number) {
  const start = dayjs(`${saison}-06-01`).startOf('day');
  return { start: start.toDate(), end: start.add(1, 'year').toDate() };
}

export type BilanCarcasse = {
  espece: string | null;
  type: CarcasseType | null;
  nombre_d_animaux: number | null;
  svi_assigned_at: Date | null;
  svi_carcasse_status: CarcasseStatus | null;
  svi_ipm1_lesions_ou_motifs: Array<string>;
  svi_ipm1_nombre_animaux: number | null;
  svi_ipm2_lesions_ou_motifs: Array<string>;
  svi_ipm2_nombre_animaux: number | null;
  examinateur_anomalies_carcasse: Array<string>;
  examinateur_anomalies_abats: Array<string>;
  etg_id: string;
};

export type BilanEtg = { id: string; nom: string; code_postal: string | null };

function emptyLigne(etg: BilanEtg, groupe_espece: BilanGroupeEspece): BilanAnomaliesLigne {
  return {
    etg_id: etg.id,
    etg_nom: etg.nom,
    etg_departement: extractDepartementFromCommune(etg.code_postal),
    groupe_espece,
    receptionnees: 0,
    controlees: 0,
    saisies_partielles: 0,
    saisies_totales: 0,
    saisies_non_signalees_fei: 0,
    ei_non_valide: 0,
    ei_non_identifiee: 0,
    saisies_totales_ei: 0,
    anomalies: {},
  };
}

// Grand gibier : 1 carcasse = 1 animal. Petit gibier : un lot, dont une partie seulement
// peut être concernée par la décision SVI.
function countAnimaux(carcasse: BilanCarcasse, animauxConcernes: number | null = null): number {
  if (carcasse.type !== CarcasseType.PETIT_GIBIER) return 1;
  return animauxConcernes ?? carcasse.nombre_d_animaux ?? 1;
}

export function buildBilanAnomalies(
  carcasses: Array<BilanCarcasse>,
  etgs: Array<BilanEtg>
): Array<BilanAnomaliesLigne> {
  const etgById = new Map(etgs.map((etg) => [etg.id, etg]));
  const lignesByEtg = new Map<string, Map<BilanGroupeEspece, BilanAnomaliesLigne>>();

  for (const carcasse of carcasses) {
    const groupe = carcasse.espece ? groupeByEspece[carcasse.espece] : undefined;
    const etg = etgById.get(carcasse.etg_id);
    if (!groupe || !etg) continue;

    let lignesEtg = lignesByEtg.get(etg.id);
    if (!lignesEtg) {
      lignesEtg = new Map(BILAN_GROUPES_ESPECES.map((g) => [g, emptyLigne(etg, g)]));
      lignesByEtg.set(etg.id, lignesEtg);
    }
    const ligne = lignesEtg.get(groupe)!;

    ligne.receptionnees += countAnimaux(carcasse);

    const status = carcasse.svi_carcasse_status;
    const isControlee =
      !!carcasse.svi_assigned_at &&
      !!status &&
      status !== CarcasseStatus.SANS_DECISION &&
      status !== CarcasseStatus.MANQUANTE_SVI;
    if (isControlee) ligne.controlees += countAnimaux(carcasse);

    const isSaisie = status === CarcasseStatus.SAISIE_PARTIELLE || status === CarcasseStatus.SAISIE_TOTALE;
    const animauxSaisis = countAnimaux(carcasse, carcasse.svi_ipm2_nombre_animaux);
    if (status === CarcasseStatus.SAISIE_PARTIELLE) ligne.saisies_partielles += animauxSaisis;
    if (status === CarcasseStatus.SAISIE_TOTALE) ligne.saisies_totales += animauxSaisis;
    const anomaliesSignaleesFei =
      carcasse.examinateur_anomalies_carcasse.length > 0 || carcasse.examinateur_anomalies_abats.length > 0;
    if (isSaisie && !anomaliesSignaleesFei) ligne.saisies_non_signalees_fei += animauxSaisis;

    // Un motif relevé en IPM1 puis en IPM2 n'est compté qu'une fois par carcasse.
    const motifs = new Set([...carcasse.svi_ipm1_lesions_ou_motifs, ...carcasse.svi_ipm2_lesions_ou_motifs]);
    const animauxInspectes = countAnimaux(
      carcasse,
      carcasse.svi_ipm2_nombre_animaux ?? carcasse.svi_ipm1_nombre_animaux
    );
    // Chapitre III : le référentiel Zacharie des motifs est le référentiel officiel, chaque motif
    // est repris tel quel. Chapitre II : seules deux anomalies d'examen initial sont tracées par des motifs.
    let isEiNonValide = false;
    let isEiNonIdentifiee = false;
    for (const motif of motifs) {
      ligne.anomalies[motif] = (ligne.anomalies[motif] ?? 0) + animauxInspectes;
      if (MOTIFS_EI_NON_VALIDE.includes(motif)) isEiNonValide = true;
      if (MOTIFS_EI_NON_IDENTIFIEE.includes(motif)) isEiNonIdentifiee = true;
    }
    if (isEiNonValide) ligne.ei_non_valide += animauxInspectes;
    if (isEiNonIdentifiee) ligne.ei_non_identifiee += animauxInspectes;
    if ((isEiNonValide || isEiNonIdentifiee) && status === CarcasseStatus.SAISIE_TOTALE) {
      ligne.saisies_totales_ei += animauxSaisis;
    }
  }

  return [...lignesByEtg.values()]
    .flatMap((lignesEtg) => [...lignesEtg.values()])
    .sort((a, b) => a.etg_nom.localeCompare(b.etg_nom, 'fr'));
}

// Les fiches créées ou tenues par un admin Zacharie (tests, démos) sont exclues, comme dans les stats fédérations.
const EXCLUDE_ADMIN_FEI_WHERE: Prisma.FeiWhereInput = {
  FeiCreatedByUser: { isNot: { isZacharieAdmin: true } },
  FeiExaminateurInitialUser: { isNot: { isZacharieAdmin: true } },
  FeiPremierDetenteurUser: { isNot: { isZacharieAdmin: true } },
};

// Carcasses tuées pendant la saison et prises en charge par un ETG (de la liste `etgIds`,
// ou n'importe quel ETG si `etgIds` est null). La carcasse est rattachée au dernier ETG qui l'a prise en charge.
export async function getBilanAnomalies(
  saison: number,
  etgIds: Array<string> | null
): Promise<BilanAnomaliesData> {
  const { start, end } = getSaisonBounds(saison);
  const etgPriseEnChargeWhere: Prisma.CarcasseIntermediaireWhereInput = {
    intermediaire_role: FeiOwnerRole.ETG,
    prise_en_charge: true,
    refus: null,
    OR: [{ manquante: null }, { manquante: false }],
    deleted_at: null,
    ...(etgIds ? { intermediaire_entity_id: { in: etgIds } } : {}),
  };

  const carcasses = await prisma.carcasse.findMany({
    where: {
      deleted_at: null,
      date_mise_a_mort: { gte: start, lt: end },
      Fei: { deleted_at: null, ...EXCLUDE_ADMIN_FEI_WHERE },
      CarcasseIntermediaire: { some: etgPriseEnChargeWhere },
    },
    select: {
      espece: true,
      type: true,
      nombre_d_animaux: true,
      svi_assigned_at: true,
      svi_carcasse_status: true,
      svi_ipm1_lesions_ou_motifs: true,
      svi_ipm1_nombre_animaux: true,
      svi_ipm2_lesions_ou_motifs: true,
      svi_ipm2_nombre_animaux: true,
      examinateur_anomalies_carcasse: true,
      examinateur_anomalies_abats: true,
      CarcasseIntermediaire: {
        where: etgPriseEnChargeWhere,
        select: { intermediaire_entity_id: true },
        orderBy: { prise_en_charge_at: 'desc' },
        take: 1,
      },
    },
  });

  const bilanCarcasses: Array<BilanCarcasse> = carcasses.map(({ CarcasseIntermediaire, ...carcasse }) => ({
    ...carcasse,
    etg_id: CarcasseIntermediaire[0].intermediaire_entity_id,
  }));

  const etgs = await prisma.entity.findMany({
    where: { id: { in: [...new Set(bilanCarcasses.map((c) => c.etg_id))] } },
    select: { id: true, nom_d_usage: true, raison_sociale: true, code_postal: true },
  });

  const lignes = buildBilanAnomalies(
    bilanCarcasses,
    etgs.map((etg) => ({
      id: etg.id,
      nom: etg.nom_d_usage || etg.raison_sociale || 'ETG',
      code_postal: etg.code_postal,
    }))
  );
  return { saison, colonnes_anomalies: getColonnesAnomalies(lignes), lignes };
}
