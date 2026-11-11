import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';
import { CarcasseStatus, CarcasseType, EntityRelationType, EntityTypes } from '@prisma/client';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Tooltip as DsfrTooltip } from '@codegouvfr/react-dsfr/Tooltip';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl';
import { BarChart } from 'react-dsfr-chart/BarChart';
import 'react-dsfr-chart/css';
import useZustandStore from '@app/zustand/store';
import { useCarcassesRegistry } from '@app/utils/useCarcassesRegistry';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { getSaisonLabel, getSaisonStartYear } from '@app/utils/get-saison';
import { buildMotifData, computeScoreBph, hasBphMotif, hasMotifDisqualifiant } from '@app/utils/bph-motifs';
import {
  ChartCard,
  MIN_COUNT_AXIS,
  MotifBarChart,
  StatCard,
  StatsSection,
} from '@app/components/stats-cards';
import departementsRegions from '@app/data/departements-regions.json';

type Categorie = 'TOUT' | CarcasseType;

// Les volumes sont comptés en animaux : 1 carcasse de grand gibier = 1, un lot de petit gibier = son
// nombre d'animaux.
type CarcasseReception = {
  carcasse: Carcasse;
  refus: string | null;
  departement: string;
  animauxRecus: number;
  animauxRefuses: number;
  animauxAcceptes: number;
};

// Refus partiel d'un lot de petit gibier : l'ETG ne saisit pas de motif.
const MOTIF_REFUS_PARTIEL = 'Non renseigné (lot accepté partiellement)';

// Décisions SVI définitives : la carcasse a été inspectée.
const DECISIONS_SVI_FINALES: Array<CarcasseStatus> = [
  CarcasseStatus.ACCEPTE,
  CarcasseStatus.SAISIE_TOTALE,
  CarcasseStatus.SAISIE_PARTIELLE,
  CarcasseStatus.LEVEE_DE_CONSIGNE,
  CarcasseStatus.TRAITEMENT_ASSAINISSANT,
];

const MAX_BARRES = 15;

const departementsNoms: Record<string, string> = departementsRegions.departements;

// Département de chasse déduit du code postal de la commune de mise à mort ("03510 CHASSENARD").
function getDepartementLabel(communeMiseAMort: string | null): string {
  const codePostal = communeMiseAMort?.trim().split(' ')[0] ?? '';
  if (!/^\d{5}$/.test(codePostal)) return 'Non renseigné';
  let code = codePostal.slice(0, 2);
  if (code === '97' || code === '98') code = codePostal.slice(0, 3);
  if (code === '20') code = Number(codePostal) < 20200 ? '2A' : '2B';
  const nom = departementsNoms[code];
  return nom ? `${nom} (${code})` : code;
}

function toTaux(count: number, total: number): number | null {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : null;
}

function formatTaux(taux: number | null): string {
  return taux === null ? '–' : `${taux.toLocaleString('fr-FR')} %`;
}

function sum(values: Array<number>) {
  return values.reduce((total, value) => total + value, 0);
}

function countBy(items: Array<[string, number]>) {
  const counts = new Map<string, number>();
  for (const [item, weight] of items) counts.set(item, (counts.get(item) ?? 0) + weight);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_BARRES);
}

// Sens d'une hausse pour l'établissement : favorable (vert), défavorable (rouge) ou sans jugement (gris).
type SensHausse = 'favorable' | 'defavorable' | 'neutre';

const EVOLUTION_COLORS: Record<'bonne' | 'mauvaise' | 'neutre', string> = {
  bonne: 'text-green-700',
  mauvaise: 'text-red-700',
  neutre: 'text-gray-500',
};

// Valeur de la même période de la saison précédente et évolution : variation relative en % pour un
// volume, écart en points pour un taux ou un score.
function Evolution({
  current,
  previous,
  mesure,
  unit = '',
  sensHausse,
}: {
  current: number | null;
  previous: number | null;
  mesure: 'volume' | 'taux';
  unit?: string;
  sensHausse: SensHausse;
}) {
  if (previous === null) return <>Saison précédente : –</>;
  const previousLabel = `${previous.toLocaleString('fr-FR')}${unit}`;
  if (current === null || (mesure === 'volume' && previous === 0)) {
    return <>Saison précédente : {previousLabel}</>;
  }
  const ecart =
    mesure === 'volume'
      ? Math.round(((current - previous) / previous) * 100)
      : Math.round((current - previous) * 10) / 10;
  let tendance: keyof typeof EVOLUTION_COLORS = 'neutre';
  if (ecart !== 0 && sensHausse !== 'neutre') {
    tendance = ecart > 0 === (sensHausse === 'favorable') ? 'bonne' : 'mauvaise';
  }
  return (
    <>
      Saison précédente : {previousLabel}{' '}
      <span className={`font-semibold ${EVOLUTION_COLORS[tendance]}`}>
        ({ecart > 0 ? '+' : ''}
        {ecart.toLocaleString('fr-FR')} {mesure === 'volume' ? '%' : 'pt'})
      </span>
    </>
  );
}

function getScoreNiveau(score: number) {
  if (score >= 85) return { label: 'Excellent', severity: 'success' as const };
  if (score >= 60) return { label: 'Bon', severity: 'info' as const };
  if (score >= 40) return { label: 'Moyen', severity: 'warning' as const };
  return { label: 'À améliorer', severity: 'error' as const };
}

// Animaux saisis par le SVI : 1 pour une carcasse, le nombre de carcasses saisies pour un lot.
function getAnimauxSaisis(r: CarcasseReception): number {
  if (r.carcasse.type !== CarcasseType.PETIT_GIBIER) return 1;
  return Math.min(r.carcasse.svi_ipm2_nombre_animaux ?? r.animauxAcceptes, r.animauxAcceptes);
}

// Score BPH moyen des apporteurs (moyenne simple) : score hygiène de chaque apporteur, calculé sur les
// carcasses de grand gibier qu'il a apportées à l'établissement, acceptées et inspectées par le SVI.
function computeScoreBphMoyen(inspectees: Array<CarcasseReception>): number | null {
  const parApporteur = new Map<string, { inspectees: number; saisiesBph: number }>();
  for (const r of inspectees) {
    if (r.carcasse.type !== CarcasseType.GROS_GIBIER) continue;
    const apporteur = r.carcasse.premier_detenteur_entity_id ?? r.carcasse.premier_detenteur_user_id;
    if (!apporteur) continue;
    const stats = parApporteur.get(apporteur) ?? { inspectees: 0, saisiesBph: 0 };
    stats.inspectees += 1;
    if (isSaisie(r.carcasse) && hasBphMotif(r.carcasse.svi_ipm2_lesions_ou_motifs ?? [])) {
      stats.saisiesBph += 1;
    }
    parApporteur.set(apporteur, stats);
  }
  const scores = [...parApporteur.values()].map((a) => computeScoreBph(a.saisiesBph, a.inspectees)!);
  return scores.length > 0 ? Math.round(sum(scores) / scores.length) : null;
}

function isSaisie(carcasse: Carcasse) {
  return (
    carcasse.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
    carcasse.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE
  );
}

function computeStats(receptions: Array<CarcasseReception>) {
  const refusees = receptions.filter((r) => r.animauxRefuses > 0);
  const inspectees = receptions.filter(
    (r) =>
      r.animauxAcceptes > 0 &&
      r.carcasse.svi_carcasse_status &&
      DECISIONS_SVI_FINALES.includes(r.carcasse.svi_carcasse_status)
  );
  const saisies = inspectees.filter((r) => isSaisie(r.carcasse));
  const saisiesDisqualifiantes = saisies.filter((r) =>
    hasMotifDisqualifiant(r.carcasse.svi_ipm2_lesions_ou_motifs ?? [])
  );
  const apporteurs = new Set(
    receptions
      .map((r) => r.carcasse.premier_detenteur_entity_id ?? r.carcasse.premier_detenteur_user_id)
      .filter(Boolean)
  );
  const total = sum(receptions.map((r) => r.animauxRecus));
  const nbRefuses = sum(refusees.map((r) => r.animauxRefuses));
  const nbInspectes = sum(inspectees.map((r) => r.animauxAcceptes));
  const nbSaisis = sum(saisies.map(getAnimauxSaisis));
  const nbSaisisDisqualifiants = sum(saisiesDisqualifiantes.map(getAnimauxSaisis));
  return {
    total,
    totalGG: sum(
      receptions.filter((r) => r.carcasse.type === CarcasseType.GROS_GIBIER).map((r) => r.animauxRecus)
    ),
    totalPG: sum(
      receptions.filter((r) => r.carcasse.type === CarcasseType.PETIT_GIBIER).map((r) => r.animauxRecus)
    ),
    apporteurs: apporteurs.size,
    especes: countBy(receptions.map((r) => [r.carcasse.espece ?? 'Non renseignée', r.animauxRecus])),
    departements: countBy(receptions.map((r) => [r.departement, r.animauxRecus])),
    refusees: nbRefuses,
    tauxRefus: toTaux(nbRefuses, total),
    motifsRefus: buildMotifData(
      refusees,
      (r) => [r.refus ?? MOTIF_REFUS_PARTIEL],
      (r) => r.animauxRefuses
    ),
    inspectees: nbInspectes,
    saisiesDisqualifiantes: nbSaisisDisqualifiants,
    scoreTri: nbInspectes > 0 ? Math.round(100 * (1 - nbSaisisDisqualifiants / nbInspectes)) : null,
    saisies: nbSaisis,
    tauxSaisie: toTaux(nbSaisis, nbInspectes),
    motifsSaisie: buildMotifData(
      saisies,
      (r) => r.carcasse.svi_ipm2_lesions_ou_motifs ?? [],
      getAnimauxSaisis
    ),
    scoreBphMoyen: computeScoreBphMoyen(inspectees),
  };
}

export default function EtgTableauDeBord() {
  const carcassesRegistry = useCarcassesRegistry();
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const entities = useZustandStore((state) => state.entities);
  const feis = useZustandStore((state) => state.feis);
  const [categorie, setCategorie] = useState<Categorie>('TOUT');
  const [espece, setEspece] = useState('');

  useLoaderEffect(() => {
    loadData('etg-tableau-de-bord');
  }, []);

  // Saison en cours jusqu'à aujourd'hui, comparée à la même période de la saison précédente.
  const periodes = useMemo(() => {
    const today = dayjs().endOf('day');
    const saison = getSaisonStartYear(today.toDate());
    return {
      saison,
      courante: { debut: dayjs(`${saison}-06-01`), fin: today },
      precedente: { debut: dayjs(`${saison - 1}-06-01`), fin: today.subtract(1, 'year') },
    };
  }, []);

  // Décision de mon ETG à réception, par carcasse (refus ou prise en charge).
  const receptions = useMemo(() => {
    const myEtgIds = new Set(
      Object.values(entities)
        .filter(
          (e) =>
            e.type === EntityTypes.ETG &&
            e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
        )
        .map((e) => e.id)
    );
    const decisionByCarcasseId = new Map<
      string,
      { refus: string | null; nombreAnimauxAcceptes: number | null }
    >();
    for (const ci of Object.values(carcassesIntermediaireById)) {
      if (ci.deleted_at || !myEtgIds.has(ci.intermediaire_entity_id)) continue;
      if (ci.refus) {
        decisionByCarcasseId.set(ci.zacharie_carcasse_id, { refus: ci.refus, nombreAnimauxAcceptes: 0 });
      } else if (ci.prise_en_charge && !decisionByCarcasseId.has(ci.zacharie_carcasse_id)) {
        decisionByCarcasseId.set(ci.zacharie_carcasse_id, {
          refus: null,
          nombreAnimauxAcceptes: ci.nombre_d_animaux_acceptes,
        });
      }
    }
    const result: Array<CarcasseReception> = [];
    for (const carcasse of carcassesRegistry) {
      const decision = decisionByCarcasseId.get(carcasse.zacharie_carcasse_id);
      if (!decision) continue;
      const animauxRecus = carcasse.type === CarcasseType.PETIT_GIBIER ? carcasse.nombre_d_animaux || 1 : 1;
      const animauxAcceptes = decision.refus
        ? 0
        : Math.min(decision.nombreAnimauxAcceptes ?? animauxRecus, animauxRecus);
      result.push({
        carcasse,
        refus: decision.refus,
        departement: getDepartementLabel(feis[carcasse.fei_numero]?.commune_mise_a_mort ?? null),
        animauxRecus,
        animauxRefuses: animauxRecus - animauxAcceptes,
        animauxAcceptes,
      });
    }
    return result;
  }, [carcassesRegistry, carcassesIntermediaireById, entities, feis]);

  const especesDisponibles = useMemo(() => {
    const especes = new Set<string>();
    for (const { carcasse } of receptions) {
      if (categorie !== 'TOUT' && carcasse.type !== categorie) continue;
      if (carcasse.espece) especes.add(carcasse.espece);
    }
    return [...especes].sort((a, b) => a.localeCompare(b));
  }, [receptions, categorie]);

  const { courante, precedente } = useMemo(() => {
    const filtered = receptions.filter(({ carcasse }) => {
      if (categorie !== 'TOUT' && carcasse.type !== categorie) return false;
      if (espece && carcasse.espece !== espece) return false;
      return true;
    });
    const inPeriode = (date: Date | null, periode: { debut: dayjs.Dayjs; fin: dayjs.Dayjs }) =>
      !!date && !dayjs(date).isBefore(periode.debut, 'day') && !dayjs(date).isAfter(periode.fin, 'day');
    return {
      courante: computeStats(
        filtered.filter((r) => inPeriode(r.carcasse.date_mise_a_mort, periodes.courante))
      ),
      precedente: computeStats(
        filtered.filter((r) => inPeriode(r.carcasse.date_mise_a_mort, periodes.precedente))
      ),
    };
  }, [receptions, categorie, espece, periodes]);

  const scoreNiveau = courante.scoreTri === null ? null : getScoreNiveau(courante.scoreTri);

  return (
    <div className="fr-container fr-container--fluid">
      <title>{`Tableau de bord | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="flex flex-col gap-6 p-4 pb-32 md:p-8">
        <header>
          <h1 className="fr-h3 mb-1">Tableau de bord</h1>
          <p className="m-0 text-sm text-gray-600">
            Saison {getSaisonLabel(periodes.saison)}, comparée à la même période de la saison précédente.
            Seules les carcasses passées par votre établissement sont comptées.
          </p>
        </header>

        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <SegmentedControl
            legend="Catégorie"
            segments={[
              {
                label: 'Tout',
                nativeInputProps: { checked: categorie === 'TOUT', onChange: () => setCategorie('TOUT') },
              },
              {
                label: 'Grand gibier',
                nativeInputProps: {
                  checked: categorie === CarcasseType.GROS_GIBIER,
                  onChange: () => {
                    setCategorie(CarcasseType.GROS_GIBIER);
                    setEspece('');
                  },
                },
              },
              {
                label: 'Petit gibier',
                nativeInputProps: {
                  checked: categorie === CarcasseType.PETIT_GIBIER,
                  onChange: () => {
                    setCategorie(CarcasseType.PETIT_GIBIER);
                    setEspece('');
                  },
                },
              },
            ]}
          />
          <Select
            label="Espèce"
            className="mb-0 md:min-w-64"
            nativeSelectProps={{ value: espece, onChange: (e) => setEspece(e.target.value) }}
          >
            <option value="">Toutes les espèces</option>
            {especesDisponibles.map((e) => (
              <option
                key={e}
                value={e}
              >
                {e}
              </option>
            ))}
          </Select>
        </div>

        <StatsSection title="Activité">
          <div className="flex flex-wrap gap-4">
            <StatCard
              label="Animaux réceptionnés"
              info="Une carcasse de grand gibier compte pour 1, un lot de petit gibier pour son nombre d'animaux."
              value={courante.total.toLocaleString('fr-FR')}
              sub={
                <Evolution
                  current={courante.total}
                  previous={precedente.total}
                  mesure="volume"
                  sensHausse="favorable"
                />
              }
            />
            {categorie === 'TOUT' && (
              <>
                <StatCard
                  label="Grand gibier"
                  value={courante.totalGG.toLocaleString('fr-FR')}
                  sub={
                    <Evolution
                      current={courante.totalGG}
                      previous={precedente.totalGG}
                      mesure="volume"
                      sensHausse="favorable"
                    />
                  }
                />
                <StatCard
                  label="Petit gibier"
                  value={courante.totalPG.toLocaleString('fr-FR')}
                  sub={
                    <Evolution
                      current={courante.totalPG}
                      previous={precedente.totalPG}
                      mesure="volume"
                      sensHausse="favorable"
                    />
                  }
                />
              </>
            )}
            <StatCard
              label="Apporteurs"
              value={courante.apporteurs.toLocaleString('fr-FR')}
              sub={
                <Evolution
                  current={courante.apporteurs}
                  previous={precedente.apporteurs}
                  mesure="volume"
                  sensHausse="favorable"
                />
              }
              info="Nombre de premiers détenteurs distincts dont vous avez réceptionné des carcasses."
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Par espèce">
              <CountBarChart
                data={courante.especes}
                ariaLabel="Carcasses réceptionnées par espèce"
              />
            </ChartCard>
            <ChartCard title="Par département de chasse">
              <CountBarChart
                data={courante.departements}
                ariaLabel="Carcasses réceptionnées par département de chasse"
              />
            </ChartCard>
          </div>
        </StatsSection>

        <StatsSection title="Contrôle à réception">
          <div className="flex flex-wrap gap-4">
            <StatCard
              label="Taux de refus"
              value={formatTaux(courante.tauxRefus)}
              sub={
                <>
                  {courante.refusees.toLocaleString('fr-FR')} refusée{courante.refusees > 1 ? 's' : ''} ·{' '}
                  <Evolution
                    current={courante.tauxRefus}
                    previous={precedente.tauxRefus}
                    mesure="taux"
                    unit=" %"
                    sensHausse="neutre"
                  />
                </>
              }
            />
            <div className="flex min-w-48 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4">
              <span className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                {courante.scoreTri === null ? '–' : `${courante.scoreTri} / 100`}
                {scoreNiveau && (
                  <Badge
                    small
                    noIcon
                    severity={scoreNiveau.severity}
                  >
                    {scoreNiveau.label}
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-1 text-sm text-gray-600">
                Score de qualité du tri à réception
                <DsfrTooltip
                  kind="hover"
                  title="Score = 100 × (1 − carcasses saisies pour balle d'abdomen ou putréfaction ÷ carcasses acceptées et inspectées par le SVI). 100 = aucune carcasse qui aurait dû être refusée n'a été présentée au SVI. Échelle : 85-100 Excellent · 60-84 Bon · 40-59 Moyen · 0-39 À améliorer."
                />
              </span>
              <span className="mt-1 text-xs text-gray-400">
                {courante.saisiesDisqualifiantes} saisie{courante.saisiesDisqualifiantes > 1 ? 's' : ''} pour
                motif disqualifiant sur {courante.inspectees} carcasse{courante.inspectees > 1 ? 's' : ''}{' '}
                inspectée{courante.inspectees > 1 ? 's' : ''} ·{' '}
                <Evolution
                  current={courante.scoreTri}
                  previous={precedente.scoreTri}
                  mesure="taux"
                  sensHausse="favorable"
                />
              </span>
            </div>
          </div>
          <ChartCard
            title="Motifs de refus"
            legend
          >
            <MotifBarChart
              data={courante.motifsRefus}
              emptyLabel="Aucun refus sur la période."
              ariaLabel="Motifs de refus"
            />
          </ChartCard>
        </StatsSection>

        <StatsSection title="Qualité de la filière">
          <div className="flex flex-wrap gap-4">
            <StatCard
              label="Taux de saisie (totales + partielles)"
              value={formatTaux(courante.tauxSaisie)}
              sub={
                <>
                  {courante.saisies.toLocaleString('fr-FR')} sur {courante.inspectees.toLocaleString('fr-FR')}{' '}
                  inspectée{courante.inspectees > 1 ? 's' : ''} ·{' '}
                  <Evolution
                    current={courante.tauxSaisie}
                    previous={precedente.tauxSaisie}
                    mesure="taux"
                    unit=" %"
                    sensHausse="defavorable"
                  />
                </>
              }
              info="Parmi les carcasses que vous avez acceptées et qui ont reçu une décision définitive du SVI."
            />
            <StatCard
              label="Score BPH moyen des apporteurs"
              value={
                categorie === CarcasseType.PETIT_GIBIER || courante.scoreBphMoyen === null
                  ? '–'
                  : `${courante.scoreBphMoyen} / 100`
              }
              sub={
                categorie === CarcasseType.PETIT_GIBIER ? (
                  'Calculé sur le grand gibier uniquement'
                ) : (
                  <Evolution
                    current={courante.scoreBphMoyen}
                    previous={precedente.scoreBphMoyen}
                    mesure="taux"
                    sensHausse="favorable"
                  />
                )
              }
              info="Moyenne des scores hygiène de vos apporteurs, chacun calculé sur les carcasses de grand gibier qu'il vous a apportées et qui ont été inspectées par le SVI. 100 = aucune saisie liée aux bonnes pratiques d'hygiène."
            />
          </div>
          <ChartCard
            title="Motifs de saisie"
            legend
          >
            <MotifBarChart
              data={courante.motifsSaisie}
              emptyLabel="Aucune saisie sur la période."
            />
          </ChartCard>
        </StatsSection>
      </div>
    </div>
  );
}

function CountBarChart({ data, ariaLabel }: { data: Array<[string, number]>; ariaLabel: string }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-500">Aucun animal sur la période.</p>;
  }
  return (
    <BarChart
      x={data.map(([label]) => label)}
      y={[data.map(([, count]) => count)]}
      name={["Nombre d'animaux"]}
      horizontal
      xMax={Math.max(...data.map(([, count]) => count), MIN_COUNT_AXIS)}
      height={Math.max(220, data.length * 28)}
      unitTooltip="animaux"
      ariaLabel={ariaLabel}
    />
  );
}
