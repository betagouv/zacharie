import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import {
  IPM2Decision,
  TrichineResultatAnalyse,
  TrichineSitePrelevement,
  TrichineType,
  type Carcasse,
} from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import Chargement from '@app/components/Chargement';
import SelectCustom from '@app/components/SelectCustom';
import LienTrichine from '@app/components/trichine/LienTrichine';
import TrichineIntrouvable from '@app/components/trichine/TrichineIntrouvable';
import {
  Bouton,
  Carte,
  Champ,
  ChampChoix,
  ChampSelect,
  ChampTexte,
  FilEtapes,
  Pastille,
} from '@app/components/trichine/wizard-ui';
import { useTrichineBasePath, useTrichinePrelevementEnLot } from '@app/utils/trichine-hooks';
import { useSviCarcassesAVenir } from '@app/utils/svi-carcasses-a-venir';
import {
  createTrichineEchantillonsBulk,
  createTrichinePool,
  getTrichineEchantillons,
  getTrichinePools,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import {
  isResultatDefavorable,
  resultatAnalyseLabels,
  resultatCourtLabels,
  sitePrelevementLabels,
  sitePrelevementOptions,
  TRICHINE_ESPECE_CONCERNEE,
  TRICHINE_MASSE_DEFAUT_FILLE,
  TRICHINE_MASSE_DEFAUT_INITIAL,
  TRICHINE_MASSE_DEFAUT_PETITE_FILLE,
  TRICHINE_POOL_FILLE_MAX_CARCASSES,
  TRICHINE_POOL_MAX_CARCASSES,
  TRICHINE_POOL_MAX_MASSE_GRAMMES,
} from '@app/utils/trichine';
import {
  erreurPool,
  LIMITES_POOL_FILLE,
  LIMITES_POOL_INITIAL,
  LIMITES_POOL_PETITE_FILLE,
  reconcilierPools,
  repartirEnPools,
  repartirIndividuellement,
  repartirParGroupe,
  type LimitesPool,
} from '@app/utils/trichine-repartition';
import {
  estPrelevable,
  etatsTrichineParCarcasse,
  type EtatTrichineCarcasse,
} from '@app/utils/trichine-prelevabilite';

const ETAPES = ['Carcasses', 'Prélèvement', 'Regroupement', 'Récapitulatif'];

type Reglage = { site_prelevement: TrichineSitePrelevement; masse_grammes: number };

/**
 * Carcasse proposée au prélèvement. Le SVI partage les locaux de l'ETG et prélève la trichine
 * dès l'arrivage : `a_venir` marque les sangliers déjà chez l'ETG mais que celui-ci ne lui a
 * pas encore officiellement transmis, servis par une route dédiée hors du store local-first.
 */
type CarcasseAPrelever = Pick<
  Carcasse,
  | 'zacharie_carcasse_id'
  | 'numero_bracelet'
  | 'fei_numero'
  | 'date_mise_a_mort'
  | 'latest_intermediaire_signed_at'
  | 'svi_ipm2_decision'
  | 'premier_detenteur_name_cache'
> & { a_venir: boolean };

/**
 * Stratégies de regroupement proposées à l'étape 3. `MANUEL` ne calcule rien : il part de
 * l'agencement affiché et laisse l'utilisateur déplacer les carcasses. `PLUS_TARD` crée les
 * échantillons sans pool, ils resteront « à regrouper » dans le suivi.
 */
type ModeRegroupement = 'AUTOMATIQUE' | 'PREMIER_DETENTEUR' | 'INDIVIDUEL' | 'MANUEL' | 'PLUS_TARD';

const MODES: Array<{ value: ModeRegroupement; label: string; hint: string }> = [
  {
    value: 'AUTOMATIQUE',
    label: 'Automatique',
    hint: `Remplit les pools jusqu'aux limites (${TRICHINE_POOL_MAX_CARCASSES} carcasses, ${TRICHINE_POOL_MAX_MASSE_GRAMMES} g)`,
  },
  {
    value: 'PREMIER_DETENTEUR',
    label: 'Par premier détenteur',
    hint: 'Deux détenteurs ne sont jamais dans le même pool',
  },
  {
    value: 'INDIVIDUEL',
    label: 'Un pool par carcasse',
    hint: 'Aucun résultat mutualisé, chaque analyse est individuelle',
  },
  {
    value: 'MANUEL',
    label: 'Manuel',
    hint: "Glissez-déposez les carcasses d'un pool à l'autre",
  },
  {
    value: 'PLUS_TARD',
    label: 'Prélever seulement',
    hint: 'Je regrouperai plus tard depuis le suivi',
  },
];

/**
 * Rang du pool qu'on s'apprête à constituer. En 2e intention, on re-prélève sur les carcasses
 * d'un pool douteux pour resserrer la recherche : une fille regroupe au plus 4 carcasses du
 * pool mère, une petite-fille en isole une seule (cf doc/trichine.md §5.1).
 */
type ModePrelevement =
  | { kind: 'INITIAL' }
  | { kind: 'FILLE'; parent: TrichinePoolPopulated }
  | { kind: 'PETITE_FILLE'; parent: TrichinePoolPopulated };

const LIMITES: Record<ModePrelevement['kind'], LimitesPool> = {
  INITIAL: LIMITES_POOL_INITIAL,
  FILLE: LIMITES_POOL_FILLE,
  PETITE_FILLE: LIMITES_POOL_PETITE_FILLE,
};

const MASSES_DEFAUT: Record<ModePrelevement['kind'], number> = {
  INITIAL: TRICHINE_MASSE_DEFAUT_INITIAL,
  FILLE: TRICHINE_MASSE_DEFAUT_FILLE,
  PETITE_FILLE: TRICHINE_MASSE_DEFAUT_PETITE_FILLE,
};

/**
 * Regrouper par premier détenteur n'a pas de sens dans un pool mère déjà constitué, et une
 * petite-fille n'a qu'une carcasse : chaque rang a ses stratégies.
 */
function modesDisponibles(kind: ModePrelevement['kind']): typeof MODES {
  if (kind === 'INITIAL') return MODES;
  if (kind === 'PETITE_FILLE') {
    return MODES.filter((option) => option.value === 'INDIVIDUEL' || option.value === 'PLUS_TARD');
  }
  return MODES.filter((option) => option.value !== 'PREMIER_DETENTEUR').map((option) =>
    option.value === 'AUTOMATIQUE'
      ? { ...option, hint: `Remplit les pools filles jusqu'à ${TRICHINE_POOL_FILLE_MAX_CARCASSES} carcasses` }
      : option
  );
}

/**
 * Assistant de prélèvement (SVI) : les sangliers arrivent par lot chez l'ETG, on prélève,
 * on regroupe et on envoie d'une traite. La modale de la fiche carcasse reste le bon outil
 * pour le cas à l'unité, pendant l'inspection.
 */
export default function TrichinePrelevementWizard() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [searchParams] = useSearchParams();
  // Référence du pool douteux quand l'assistant est monté sur `pools/:reference/2e-intention`
  const { reference } = useParams();
  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  // Les carcasses « à venir » sont servies par une route réservée au SVI : côté chasseur,
  // l'assistant n'est monté que pour la 2e intention, sur les carcasses du pool douteux.
  const { carcasses: carcassesAVenir } = useSviCarcassesAVenir(useTrichinePrelevementEnLot());

  const [etape, setEtape] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [poolsExistants, setPoolsExistants] = useState<Array<TrichinePoolPopulated>>([]);
  const [etats, setEtats] = useState<Map<string, EtatTrichineCarcasse>>(new Map());
  const [selection, setSelection] = useState<Array<string>>(() =>
    (searchParams.get('carcasses') ?? '').split(',').filter(Boolean)
  );

  const [reglageCommun, setReglageCommun] = useState<Reglage>({
    site_prelevement: TrichineSitePrelevement.PILIER_DIAPHRAGME,
    masse_grammes: TRICHINE_MASSE_DEFAUT_INITIAL,
  });
  const [datePrelevement, setDatePrelevement] = useState(dayjs().format('YYYY-MM-DD'));
  const [exceptions, setExceptions] = useState<Record<string, Reglage>>({});

  const [mode, setMode] = useState<ModeRegroupement>('AUTOMATIQUE');
  const [pools, setPools] = useState<Array<Array<string>>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultat, setResultat] = useState<{
    echantillons: number;
    pools: Array<{ id: string; reference: string; carcasses: number }>;
  } | null>(null);

  // Les pools donnent les FTP et le résultat du laboratoire : l'échantillon ne connaît que son pool
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    Promise.all([getTrichineEchantillons(), getTrichinePools()])
      .then(([reponseEchantillons, reponsePools]) => {
        const pools = reponsePools.data?.pools ?? [];
        setPoolsExistants(pools);
        setEtats(etatsTrichineParCarcasse(reponseEchantillons.data?.echantillons ?? [], pools));
      })
      .catch(console.error)
      .finally(() => setChargement(false));
  }, []);

  const parent = useMemo(
    () => (reference ? (poolsExistants.find((pool) => pool.reference_pool === reference) ?? null) : null),
    [reference, poolsExistants]
  );

  const modePrelevement = useMemo<ModePrelevement>(() => {
    if (!parent) return { kind: 'INITIAL' };
    return parent.pool_parent_id ? { kind: 'PETITE_FILLE', parent } : { kind: 'FILLE', parent };
  }, [parent]);

  const limites = LIMITES[modePrelevement.kind];

  // La masse réglementaire dépend du rang du pool : 5 g en initial, 20 g en fille, 50 g en petite-fille
  useEffect(() => {
    setReglageCommun((precedent) => ({
      ...precedent,
      masse_grammes: MASSES_DEFAUT[modePrelevement.kind],
    }));
  }, [modePrelevement.kind]);

  // Une petite-fille n'isole qu'une carcasse : le seul regroupement possible est individuel
  useEffect(() => {
    if (modePrelevement.kind === 'PETITE_FILLE') setMode('INDIVIDUEL');
  }, [modePrelevement.kind]);

  // 2e intention : le lot de départ, ce sont les carcasses du pool douteux qu'aucune fille ne couvre
  useEffect(() => {
    if (!parent) return;
    setSelection(
      parent.TrichineEchantillons.filter((echantillon) => !echantillon.deleted_at)
        .map((echantillon) => echantillon.zacharie_carcasse_id)
        .filter((carcasseId) => estPrelevable(etats.get(carcasseId), parent.id))
    );
  }, [parent, etats]);

  // Une présélection d'URL ne garde que les carcasses réellement prélevables dans ce mode
  useEffect(() => {
    if (chargement) return;
    setSelection((precedente) =>
      precedente.filter((carcasseId) => estPrelevable(etats.get(carcasseId), parent?.id ?? null))
    );
  }, [chargement, etats, parent]);

  // Tous les sangliers du registre SVI, hors carcasses supprimées ou retirées de leur fiche,
  // plus ceux déjà arrivés chez un ETG rattaché au service et pas encore transmis. Celles déjà
  // prélevées restent affichées avec leur pool et leur FTP, mais non sélectionnables.
  const sangliers = useMemo<Array<CarcasseAPrelever>>(() => {
    const transmises = carcassesRegistry
      .filter(
        (carcasse) =>
          carcasse.espece === TRICHINE_ESPECE_CONCERNEE &&
          !carcasse.deleted_at &&
          !carcasse.trichine_retire_de_fei_at
      )
      .map((carcasse) => ({ ...carcasse, a_venir: false }));
    const dejaListees = new Set(transmises.map((carcasse) => carcasse.zacharie_carcasse_id));
    const aVenir = (carcassesAVenir ?? [])
      .filter(
        (carcasse) =>
          carcasse.espece === TRICHINE_ESPECE_CONCERNEE && !dejaListees.has(carcasse.zacharie_carcasse_id)
      )
      .map((carcasse) => ({
        zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
        numero_bracelet: carcasse.numero_bracelet,
        fei_numero: carcasse.fei_numero,
        date_mise_a_mort: carcasse.date_mise_a_mort,
        // Réception = prise en charge par l'ETG, la carcasse est physiquement sur place
        latest_intermediaire_signed_at: carcasse.arrived_at,
        svi_ipm2_decision: null,
        premier_detenteur_name_cache: carcasse.premier_detenteur_name_cache,
        a_venir: true,
      }));
    return [...transmises, ...aVenir];
  }, [carcassesRegistry, carcassesAVenir]);

  // 2e intention : seules les carcasses du pool douteux peuvent entrer dans une fille
  const proposees = useMemo<Array<CarcasseAPrelever>>(() => {
    if (!parent) return sangliers;
    const duParent = new Set(
      parent.TrichineEchantillons.filter((echantillon) => !echantillon.deleted_at).map(
        (echantillon) => echantillon.zacharie_carcasse_id
      )
    );
    return sangliers.filter((carcasse) => duParent.has(carcasse.zacharie_carcasse_id));
  }, [sangliers, parent]);

  const parId = useMemo(
    () => new Map(proposees.map((carcasse) => [carcasse.zacharie_carcasse_id, carcasse])),
    [proposees]
  );

  const reglageDe = (carcasseId: string): Reglage => exceptions[carcasseId] ?? reglageCommun;

  const premierDetenteurDe = (carcasseId: string) =>
    parId.get(carcasseId)?.premier_detenteur_name_cache || 'Détenteur non renseigné';

  const aRepartir = () =>
    selection.map((carcasseId) => ({
      zacharie_carcasse_id: carcasseId,
      masse_grammes: reglageDe(carcasseId).masse_grammes,
    }));

  const repartirSelon = (nouveauMode: ModeRegroupement, precedents: Array<Array<string>>) => {
    switch (nouveauMode) {
      case 'PREMIER_DETENTEUR':
        return repartirParGroupe(
          aRepartir(),
          (carcasse) => premierDetenteurDe(carcasse.zacharie_carcasse_id),
          limites
        );
      case 'INDIVIDUEL':
        return repartirIndividuellement(aRepartir());
      case 'AUTOMATIQUE':
        return repartirEnPools(aRepartir(), limites);
      // MANUEL / PLUS_TARD : on garde l'agencement affiché, aligné sur la sélection
      default:
        return reconcilierPools(precedents, aRepartir(), limites);
    }
  };

  const allerEtape2 = () => {
    setPools((precedents) => repartirSelon(mode, precedents));
    setEtape(2);
  };

  const changerMode = (nouveauMode: ModeRegroupement) => {
    setMode(nouveauMode);
    setPools((precedents) => repartirSelon(nouveauMode, precedents));
  };

  // Déplacer une carcasse à la main sort forcément d'un mode calculé
  const deplacer = (carcasseId: string, indexCible: number) => {
    setMode('MANUEL');
    setPools((precedents) => {
      const suivants = precedents.map((pool) => pool.filter((id) => id !== carcasseId));
      while (suivants.length <= indexCible) suivants.push([]);
      suivants[indexCible].push(carcasseId);
      return suivants.filter((pool, index) => pool.length > 0 || index === indexCible);
    });
  };

  const creer = async () => {
    setIsSubmitting(true);
    try {
      const response = await createTrichineEchantillonsBulk({
        // Un prélèvement de 2e intention est un complémentaire, fille comme petite-fille :
        // CONFIRMATION reste réservé aux analyses du LNR
        type: modePrelevement.kind === 'INITIAL' ? TrichineType.INITIAL : TrichineType.COMPLEMENTAIRE,
        echantillons: selection.map((carcasseId) => ({
          zacharie_carcasse_id: carcasseId,
          site_prelevement: reglageDe(carcasseId).site_prelevement,
          masse_grammes: reglageDe(carcasseId).masse_grammes,
          date_prelevement: datePrelevement,
        })),
      });
      if (!response.ok || !response.data) {
        toast.error(response.error || 'Le prélèvement n’a pas pu être enregistré');
        return;
      }
      const echantillons = response.data.echantillons;
      const idParCarcasse = new Map(
        echantillons.map((echantillon) => [echantillon.zacharie_carcasse_id, echantillon.id])
      );

      const poolsCrees: Array<{ id: string; reference: string; carcasses: number }> = [];
      if (mode !== 'PLUS_TARD') {
        for (const pool of pools.filter((groupe) => groupe.length > 0)) {
          const echantillonIds = pool
            .map((carcasseId) => idParCarcasse.get(carcasseId))
            .filter(Boolean) as Array<string>;
          const poolResponse = await createTrichinePool({
            echantillon_ids: echantillonIds,
            pool_parent_id: modePrelevement.kind === 'INITIAL' ? undefined : modePrelevement.parent.id,
          });
          if (poolResponse.ok && poolResponse.data) {
            poolsCrees.push({
              id: poolResponse.data.pool.id,
              reference: poolResponse.data.pool.reference_pool,
              carcasses: echantillonIds.length,
            });
          } else {
            toast.error(poolResponse.error || 'Un pool n’a pas pu être créé');
          }
        }
      }
      setResultat({ echantillons: echantillons.length, pools: poolsCrees });
      setEtape(4);
    } catch (error) {
      console.error(error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (reference && chargement) {
    return <Chargement />;
  }

  if (reference && !parent) {
    return (
      <TrichineIntrouvable
        objet="Pool"
        reference={reference}
        retour={{ to: `${basePath}/pools`, label: 'Voir tous les pools' }}
        basePath={basePath}
      />
    );
  }

  if (parent && parent.resultat_analyse !== TrichineResultatAnalyse.DOUTEUX) {
    return (
      <ImpossibleDeuxiemeIntention
        basePath={basePath}
        reference={parent.reference_pool}
        raison={`Le pool ${parent.reference_pool} n'a pas de résultat douteux. Les analyses de 2e intention ne se déclenchent qu'après un résultat douteux, pour identifier la carcasse en cause.`}
      />
    );
  }

  // La hiérarchie s'arrête à la petite-fille : sous une carcasse isolée, il n'y a plus rien à resserrer
  if (
    parent?.pool_parent_id &&
    poolsExistants.find((pool) => pool.id === parent.pool_parent_id)?.pool_parent_id
  ) {
    return (
      <ImpossibleDeuxiemeIntention
        basePath={basePath}
        reference={parent.reference_pool}
        raison="La hiérarchie des pools est limitée à mère / fille / petite-fille : le pool ne peut plus être resserré. La confirmation revient au LNR."
      />
    );
  }

  if (resultat) {
    return (
      <EcranFinal
        basePath={basePath}
        echantillons={resultat.echantillons}
        pools={resultat.pools}
        datePrelevement={datePrelevement}
        parent={parent}
        onRecommencer={() => {
          setResultat(null);
          setSelection([]);
          setExceptions({});
          setPools([]);
          setMode('AUTOMATIQUE');
          setEtape(0);
        }}
      />
    );
  }

  return (
    <div className="w-full py-4">
      <title>
        {parent
          ? `Analyses de 2e intention | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`
          : `Prélever | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      <Link
        to={parent ? `${basePath}/pools/${parent.reference_pool}` : basePath}
        className="fr-link fr-link--sm fr-mb-2w"
      >
        {parent ? `← Pool ${parent.reference_pool}` : '← Suivi trichine'}
      </Link>

      <h1 className="m-0 mb-1 text-2xl font-bold text-gray-900">
        {parent
          ? `Analyses de 2e intention — pool ${parent.reference_pool}`
          : 'Prélever pour la recherche de trichine'}
      </h1>
      <FilEtapes
        etapes={ETAPES}
        courante={etape}
      />

      {etape === 0 && (
        <EtapeCarcasses
          carcasses={proposees}
          etats={etats}
          parentPoolId={parent?.id ?? null}
          selection={selection}
          onSelection={setSelection}
        />
      )}

      {etape === 1 && (
        <EtapePrelevement
          selection={selection}
          parId={parId}
          reglageCommun={reglageCommun}
          onReglageCommun={setReglageCommun}
          datePrelevement={datePrelevement}
          onDatePrelevement={setDatePrelevement}
          exceptions={exceptions}
          onExceptions={setExceptions}
        />
      )}

      {etape === 2 && (
        <EtapeRegroupement
          pools={pools}
          parId={parId}
          reglageDe={reglageDe}
          premierDetenteurDe={premierDetenteurDe}
          mode={mode}
          modes={modesDisponibles(modePrelevement.kind)}
          limites={limites}
          onMode={changerMode}
          onDeplacer={deplacer}
        />
      )}

      {etape === 3 && (
        <EtapeRecapitulatif
          selection={selection}
          pools={mode === 'PLUS_TARD' ? [] : pools.filter((pool) => pool.length > 0)}
          parId={parId}
          datePrelevement={datePrelevement}
          mode={mode}
          limites={limites}
          parent={parent}
          reglageCommun={reglageCommun}
          reglageDe={reglageDe}
          nbExceptions={Object.keys(exceptions).length}
          premierDetenteurDe={premierDetenteurDe}
        />
      )}

      {/* Barre d'actions collante : les listes sont longues, les boutons doivent rester atteignables */}
      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white/95 py-3 backdrop-blur">
        <Bouton
          variante="secondaire"
          onClick={() => (etape === 0 ? navigate(basePath) : setEtape(etape - 1))}
        >
          {etape === 0 ? 'Annuler' : '← Précédent'}
        </Bouton>
        <p className="m-0 text-sm text-gray-600">
          {selection.length} carcasse{selection.length > 1 ? 's' : ''} sélectionnée
          {selection.length > 1 ? 's' : ''}
        </p>
        {etape < 3 ? (
          <Bouton
            disabled={etape === 0 && selection.length === 0}
            onClick={() => (etape === 1 ? allerEtape2() : setEtape(etape + 1))}
          >
            Continuer →
          </Bouton>
        ) : (
          <Bouton
            disabled={isSubmitting}
            onClick={creer}
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer le prélèvement'}
          </Bouton>
        )}
      </div>
    </div>
  );
}

/**
 * La 2e intention ne s'ouvre qu'après un résultat douteux, et s'arrête à la petite-fille.
 * Hors de ces cas, on explique pourquoi plutôt que d'afficher un assistant qui échouera.
 */
function ImpossibleDeuxiemeIntention({
  basePath,
  reference,
  raison,
}: {
  basePath: string;
  reference: string;
  raison: string;
}) {
  return (
    <div className="w-full py-4">
      <title>
        Analyses de 2e intention | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <Carte titre="Aucune analyse de 2e intention possible">
        <p className="m-0 text-sm text-gray-700">{raison}</p>
        <div className="mt-4">
          <Link
            to={`${basePath}/pools/${reference}`}
            className="rounded border border-[#000091] bg-white px-5 py-2.5 text-sm font-medium text-[#000091] no-underline hover:bg-gray-50"
          >
            Retour au pool
          </Link>
        </div>
      </Carte>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ① Carcasses                                                                 */
/* -------------------------------------------------------------------------- */

const IPM2_LABELS: Record<IPM2Decision, string> = {
  [IPM2Decision.NON_RENSEIGNEE]: 'Non renseignée',
  [IPM2Decision.LEVEE_DE_LA_CONSIGNE]: 'Levée de la consigne',
  [IPM2Decision.SAISIE_TOTALE]: 'Saisie totale',
  [IPM2Decision.SAISIE_PARTIELLE]: 'Saisie partielle',
  [IPM2Decision.TRAITEMENT_ASSAINISSANT]: 'Traitement assainissant',
};

const IPM2_TONS: Record<IPM2Decision, 'neutre' | 'succes' | 'attention' | 'alerte'> = {
  [IPM2Decision.NON_RENSEIGNEE]: 'neutre',
  [IPM2Decision.LEVEE_DE_LA_CONSIGNE]: 'succes',
  [IPM2Decision.SAISIE_TOTALE]: 'alerte',
  [IPM2Decision.SAISIE_PARTIELLE]: 'attention',
  [IPM2Decision.TRAITEMENT_ASSAINISSANT]: 'attention',
};

function DecisionIpm2({ carcasse }: { carcasse: CarcasseAPrelever }) {
  const decision = carcasse.svi_ipm2_decision;
  if (!decision || decision === IPM2Decision.NON_RENSEIGNEE) {
    return null;
  }
  // Le libellé « IPM2 » est porté par l'en-tête de colonne, la pastille n'a que la décision
  return <Pastille ton={IPM2_TONS[decision]}>{IPM2_LABELS[decision]}</Pastille>;
}

const PERIODES = [
  { value: '', label: 'Toutes les dates' },
  { value: '7', label: '7 derniers jours' },
  { value: '30', label: '30 derniers jours' },
  { value: '90', label: '3 derniers mois' },
];

const IPM2_FILTRES = [
  { value: '', label: 'Toutes les décisions' },
  ...Object.values(IPM2Decision).map((decision) => ({
    value: decision,
    label: decision === IPM2Decision.NON_RENSEIGNEE ? 'IPM2 non renseignée' : IPM2_LABELS[decision],
  })),
];

/** Valeur des filtres pool, FTP et résultat pour « rien », carcasses non prélevées comprises */
const SANS_RATTACHEMENT = 'SANS';

/** Valeur du filtre résultat regroupant positif, non négatif et parasite non identifié */
const RESULTAT_DEFAVORABLE = 'DEFAVORABLE';

const RESULTAT_TONS: Record<TrichineResultatAnalyse, 'succes' | 'attention' | 'alerte'> = {
  [TrichineResultatAnalyse.NEGATIF]: 'succes',
  [TrichineResultatAnalyse.DOUTEUX]: 'attention',
  [TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE]: 'attention',
  [TrichineResultatAnalyse.NON_NEGATIF]: 'alerte',
  [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: 'alerte',
  [TrichineResultatAnalyse.POSITIF]: 'alerte',
};

const RESULTAT_FILTRES = [
  { value: '', label: 'Tous les résultats' },
  { value: SANS_RATTACHEMENT, label: 'Sans résultat' },
  { value: RESULTAT_DEFAVORABLE, label: 'Défavorables uniquement' },
  ...Object.values(TrichineResultatAnalyse).map((valeur) => ({
    value: valeur,
    label: resultatAnalyseLabels[valeur],
  })),
];

type OptionFiche = { value: string; label: string; nombre: number };

function correspondAuResultat(resultatCarcasse: TrichineResultatAnalyse | null, filtre: string) {
  if (filtre === SANS_RATTACHEMENT) return !resultatCarcasse;
  if (filtre === RESULTAT_DEFAVORABLE) return isResultatDefavorable(resultatCarcasse);
  return resultatCarcasse === filtre;
}

function decisionIpm2De(carcasse: CarcasseAPrelever): IPM2Decision {
  return carcasse.svi_ipm2_decision ?? IPM2Decision.NON_RENSEIGNEE;
}

function EtapeCarcasses({
  carcasses,
  etats,
  parentPoolId,
  selection,
  onSelection,
}: {
  carcasses: Array<CarcasseAPrelever>;
  etats: Map<string, EtatTrichineCarcasse>;
  /** Pool douteux qu'on resserre, null pour un prélèvement initial */
  parentPoolId: string | null;
  selection: Array<string>;
  onSelection: (ids: Array<string>) => void;
}) {
  const basePath = useTrichineBasePath();
  const [recherche, setRecherche] = useState('');
  const [fiche, setFiche] = useState('');
  const [ipm2, setIpm2] = useState('');
  const [miseAMort, setMiseAMort] = useState('');
  const [reception, setReception] = useState('');
  const [pool, setPool] = useState('');
  const [ftp, setFtp] = useState('');
  const [resultat, setResultat] = useState('');

  const optionsFiches = useMemo(() => {
    const compte = new Map<string, number>();
    for (const carcasse of carcasses) {
      if (carcasse.fei_numero) compte.set(carcasse.fei_numero, (compte.get(carcasse.fei_numero) ?? 0) + 1);
    }
    return [...compte.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([numero, nombre]) => ({ value: numero, label: numero, nombre }));
  }, [carcasses]);

  // On ne propose que les pools et les FTP qui portent une carcasse de la liste
  const { optionsPools, optionsFtps } = useMemo(() => {
    const pools = new Map<string, number>();
    const ftps = new Map<string, number>();
    for (const carcasse of carcasses) {
      const etat = etats.get(carcasse.zacharie_carcasse_id);
      if (!etat) continue;
      if (etat.pool) pools.set(etat.pool, (pools.get(etat.pool) ?? 0) + 1);
      for (const numero of etat.ftps) ftps.set(numero, (ftps.get(numero) ?? 0) + 1);
    }
    const enOptions = (compte: Map<string, number>) =>
      [...compte.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([reference, nombre]) => ({ value: reference, label: `${reference} (${nombre})` }));
    return { optionsPools: enOptions(pools), optionsFtps: enOptions(ftps) };
  }, [carcasses, etats]);

  const visibles = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const limiteMiseAMort = miseAMort ? dayjs().subtract(Number(miseAMort), 'day') : null;
    const limiteReception = reception ? dayjs().subtract(Number(reception), 'day') : null;
    return carcasses.filter((carcasse) => {
      const etat = etats.get(carcasse.zacharie_carcasse_id);
      if (terme && !carcasse.numero_bracelet?.toLowerCase().includes(terme)) return false;
      if (fiche && carcasse.fei_numero !== fiche) return false;
      if (ipm2 && decisionIpm2De(carcasse) !== ipm2) return false;
      if (pool && (pool === SANS_RATTACHEMENT ? !!etat?.pool : etat?.pool !== pool)) return false;
      if (ftp && (ftp === SANS_RATTACHEMENT ? !!etat?.ftps.length : !etat?.ftps.includes(ftp))) return false;
      if (resultat && !correspondAuResultat(etat?.resultat ?? null, resultat)) return false;
      if (
        limiteMiseAMort &&
        (!carcasse.date_mise_a_mort || dayjs(carcasse.date_mise_a_mort).isBefore(limiteMiseAMort))
      ) {
        return false;
      }
      if (
        limiteReception &&
        (!carcasse.latest_intermediaire_signed_at ||
          dayjs(carcasse.latest_intermediaire_signed_at).isBefore(limiteReception))
      ) {
        return false;
      }
      return true;
    });
  }, [carcasses, etats, recherche, fiche, ipm2, miseAMort, reception, pool, ftp, resultat]);

  const idsSelectionnables = visibles
    .filter((carcasse) => estPrelevable(etats.get(carcasse.zacharie_carcasse_id), parentPoolId))
    .map((carcasse) => carcasse.zacharie_carcasse_id);
  const tousVisiblesSelectionnes =
    idsSelectionnables.length > 0 && idsSelectionnables.every((id) => selection.includes(id));
  const nonPrelevablesVisibles = visibles.length - idsSelectionnables.length;
  // Une carcasse cochée puis masquée par un filtre reste dans la sélection : on le dit.
  const selectionMasquee = selection.filter((id) => !idsSelectionnables.includes(id)).length;
  const filtresActifs = [fiche, ipm2, miseAMort, reception, pool, ftp, resultat, recherche.trim()].filter(
    Boolean
  ).length;

  const basculer = (carcasseId: string) =>
    onSelection(
      selection.includes(carcasseId)
        ? selection.filter((id) => id !== carcasseId)
        : [...selection, carcasseId]
    );

  const nbAVenir = carcasses.filter((carcasse) => carcasse.a_venir).length;

  return (
    <Carte
      titre="Carcasses"
      hint={
        nbAVenir > 0
          ? `${nbAVenir} carcasse${nbAVenir > 1 ? 's sont' : ' est'} arrivée${nbAVenir > 1 ? 's' : ''} chez l'ETG sans vous avoir encore été transmise${nbAVenir > 1 ? 's' : ''} : elles sont marquées « Non transmise au SVI » et restent prélevables.`
          : undefined
      }
    >
      {/* Le lot d’une 2e intention tient en une page : les filtres ne servent qu’au registre complet */}
      {!parentPoolId && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Champ label="N° de marquage">
            <ChampTexte
              type="search"
              value={recherche}
              placeholder="MM-888-…"
              onChange={(event) => setRecherche(event.target.value)}
            />
          </Champ>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-900">Fiche</span>
            {/* Combobox et non liste déroulante : une saison compte des centaines de fiches,
                et un numéro se retrouve en tapant sa date. */}
            <SelectCustom<OptionFiche>
              options={optionsFiches}
              value={optionsFiches.find((option) => option.value === fiche) ?? null}
              isClearable
              placeholder={`Toutes les fiches (${carcasses.length})`}
              noOptionsMessage={() => 'Aucune fiche ne correspond'}
              onChange={(option) => setFiche((option as OptionFiche | null)?.value ?? '')}
              formatOptionLabel={(option, meta) =>
                meta.context === 'menu' ? (
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>{option.label}</span>
                    <span className="text-xs text-gray-600">
                      {option.nombre} carcasse{option.nombre > 1 ? 's' : ''}
                    </span>
                  </span>
                ) : (
                  option.label
                )
              }
            />
          </div>
          <Champ label="Décision IPM2">
            <ChampSelect
              value={ipm2}
              onChange={(event) => setIpm2(event.target.value)}
            >
              {IPM2_FILTRES.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </ChampSelect>
          </Champ>
          <Champ label="Réception">
            <ChampSelect
              value={reception}
              onChange={(event) => setReception(event.target.value)}
            >
              {PERIODES.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </ChampSelect>
          </Champ>
          <Champ label="Mise à mort">
            <ChampSelect
              value={miseAMort}
              onChange={(event) => setMiseAMort(event.target.value)}
            >
              {PERIODES.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </ChampSelect>
          </Champ>
          <Champ label="Pool">
            <ChampSelect
              value={pool}
              onChange={(event) => setPool(event.target.value)}
            >
              <option value="">Tous les pools</option>
              <option value={SANS_RATTACHEMENT}>Sans pool</option>
              {optionsPools.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </ChampSelect>
          </Champ>
          <Champ label="Fiche de transmission">
            <ChampSelect
              value={ftp}
              onChange={(event) => setFtp(event.target.value)}
            >
              <option value="">Toutes les fiches de transmission</option>
              <option value={SANS_RATTACHEMENT}>Sans fiche de transmission</option>
              {optionsFtps.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </ChampSelect>
          </Champ>
          <Champ label="Résultat du laboratoire">
            <ChampSelect
              value={resultat}
              onChange={(event) => setResultat(event.target.value)}
            >
              {RESULTAT_FILTRES.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </ChampSelect>
          </Champ>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
        <p className="m-0 text-sm text-gray-700">
          <strong>{visibles.length}</strong> carcasse{visibles.length > 1 ? 's' : ''} affichée
          {visibles.length > 1 ? 's' : ''}
          {filtresActifs > 0 && <> sur {carcasses.length}</>} · <strong>{selection.length}</strong>{' '}
          sélectionnée{selection.length > 1 ? 's' : ''}
          {selectionMasquee > 0 && (
            <span className="text-gray-500"> (dont {selectionMasquee} hors filtres)</span>
          )}
          {nonPrelevablesVisibles > 0 && (
            <span className="text-gray-500">
              {' '}
              · {nonPrelevablesVisibles}{' '}
              {parentPoolId
                ? `déjà couverte${nonPrelevablesVisibles > 1 ? 's' : ''} par une 2e intention`
                : `déjà prélevée${nonPrelevablesVisibles > 1 ? 's' : ''}`}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {filtresActifs > 0 && (
            <Bouton
              variante="discret"
              petit
              onClick={() => {
                setRecherche('');
                setFiche('');
                setIpm2('');
                setMiseAMort('');
                setReception('');
                setPool('');
                setFtp('');
                setResultat('');
              }}
            >
              Effacer les filtres
            </Bouton>
          )}
          <Bouton
            variante="secondaire"
            petit
            disabled={idsSelectionnables.length === 0}
            onClick={() =>
              onSelection(
                tousVisiblesSelectionnes
                  ? selection.filter((id) => !idsSelectionnables.includes(id))
                  : [...new Set([...selection, ...idsSelectionnables])]
              )
            }
          >
            {tousVisiblesSelectionnes ? 'Tout décocher' : 'Tout sélectionner'}
          </Bouton>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="m-0 py-8 text-center text-sm text-gray-500">
          {carcasses.length === 0
            ? 'Aucun sanglier dans le registre. Les carcasses retirées de leur fiche ne sont pas proposées.'
            : 'Aucune carcasse ne correspond aux filtres.'}
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-gray-300 text-left text-xs tracking-wide text-gray-600 uppercase">
                <th className="w-10 py-2 font-medium" />
                <th className="py-2 font-medium">N° de marquage</th>
                <th className="py-2 font-medium">Fiche</th>
                <th className="py-2 font-medium whitespace-nowrap">Réception</th>
                <th className="py-2 font-medium whitespace-nowrap">Mise à mort</th>
                <th className="py-2 font-medium">Pool</th>
                <th className="py-2 font-medium">FTP</th>
                <th className="py-2 font-medium">Résultat</th>
                <th className="py-2 text-right font-medium">IPM2</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((carcasse) => {
                const etat = etats.get(carcasse.zacharie_carcasse_id);
                const prelevable = estPrelevable(etat, parentPoolId);
                const checked = selection.includes(carcasse.zacharie_carcasse_id);
                return (
                  <tr
                    key={carcasse.zacharie_carcasse_id}
                    className={`border-b border-gray-100 last:border-0 ${
                      !prelevable
                        ? 'bg-gray-50'
                        : checked
                          ? 'cursor-pointer bg-blue-50'
                          : 'cursor-pointer hover:bg-gray-50'
                    }`}
                    onClick={() => prelevable && basculer(carcasse.zacharie_carcasse_id)}
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#000091]"
                        checked={checked}
                        disabled={!prelevable}
                        aria-label={
                          prelevable
                            ? `Sélectionner ${carcasse.numero_bracelet}`
                            : `${carcasse.numero_bracelet} non prélevable`
                        }
                        onChange={() => basculer(carcasse.zacharie_carcasse_id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td className="py-2 font-semibold text-gray-900">
                      {carcasse.numero_bracelet}
                      {carcasse.a_venir && (
                        <span className="ml-2 align-middle font-normal">
                          <Pastille ton="attention">Non transmise au SVI</Pastille>
                        </span>
                      )}
                    </td>
                    <td
                      className="max-w-64 truncate py-2 text-gray-600"
                      title={carcasse.fei_numero}
                    >
                      {carcasse.fei_numero}
                    </td>
                    <td className="py-2 whitespace-nowrap text-gray-600">
                      {carcasse.latest_intermediaire_signed_at
                        ? dayjs(carcasse.latest_intermediaire_signed_at).format('DD/MM/YYYY')
                        : '—'}
                    </td>
                    <td className="py-2 whitespace-nowrap text-gray-600">
                      {carcasse.date_mise_a_mort
                        ? dayjs(carcasse.date_mise_a_mort).format('DD/MM/YYYY')
                        : '—'}
                    </td>
                    <td className="py-2 whitespace-nowrap text-gray-600">
                      {!etat ? (
                        '—'
                      ) : etat.pool ? (
                        <LienTrichine to={`${basePath}/pools/${etat.pool}`}>{etat.pool}</LienTrichine>
                      ) : (
                        <Pastille ton="info">À regrouper</Pastille>
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap text-gray-600">
                      {etat?.ftps.length
                        ? etat.ftps.map((numero, index) => (
                            <span key={numero}>
                              {index > 0 && ', '}
                              <LienTrichine to={`${basePath}/ftp/${numero}`}>{numero}</LienTrichine>
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td className="py-2 whitespace-nowrap text-gray-600">
                      {etat?.resultat ? (
                        <Pastille ton={RESULTAT_TONS[etat.resultat]}>
                          {resultatCourtLabels[etat.resultat]}
                        </Pastille>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <DecisionIpm2 carcasse={carcasse} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Carte>
  );
}

/* -------------------------------------------------------------------------- */
/* ② Prélèvement                                                               */
/* -------------------------------------------------------------------------- */

function EtapePrelevement({
  selection,
  parId,
  reglageCommun,
  onReglageCommun,
  datePrelevement,
  onDatePrelevement,
  exceptions,
  onExceptions,
}: {
  selection: Array<string>;
  parId: Map<string, CarcasseAPrelever>;
  reglageCommun: Reglage;
  onReglageCommun: (reglage: Reglage) => void;
  datePrelevement: string;
  onDatePrelevement: (value: string) => void;
  exceptions: Record<string, Reglage>;
  onExceptions: (exceptions: Record<string, Reglage>) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const nbExceptions = Object.keys(exceptions).length;

  return (
    <Carte
      titre="Prélèvement"
      actions={
        <Bouton
          variante="secondaire"
          petit
          onClick={() => setOuvert((value) => !value)}
        >
          {ouvert ? 'Masquer le détail' : 'Ajuster une carcasse'}
          {nbExceptions > 0 ? ` (${nbExceptions})` : ''}
        </Bouton>
      }
    >
      <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-3">
          <ChampChoix
            label="Site de prélèvement"
            value={reglageCommun.site_prelevement}
            options={sitePrelevementOptions}
            onChange={(site) => onReglageCommun({ ...reglageCommun, site_prelevement: site })}
          />
        </div>
        <Champ label="Masse par carcasse (g)">
          <ChampTexte
            type="number"
            min={1}
            value={reglageCommun.masse_grammes}
            onChange={(event) =>
              onReglageCommun({ ...reglageCommun, masse_grammes: Number(event.target.value) || 1 })
            }
          />
        </Champ>
        <Champ label="Date de prélèvement">
          <ChampTexte
            type="date"
            value={datePrelevement}
            onChange={(event) => onDatePrelevement(event.target.value)}
          />
        </Champ>
      </div>

      {ouvert && (
        <div className="mt-4 max-h-[28rem] overflow-y-auto border-t border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-300 text-left text-xs tracking-wide text-gray-600 uppercase">
                <th className="py-2 font-medium">N° de marquage</th>
                <th className="py-2 font-medium">Site</th>
                <th className="py-2 font-medium">Masse (g)</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {selection.map((carcasseId) => {
                const carcasse = parId.get(carcasseId);
                const reglage = exceptions[carcasseId] ?? reglageCommun;
                const modifiee = !!exceptions[carcasseId];
                return (
                  <tr
                    key={carcasseId}
                    className={`border-b border-gray-100 last:border-0 ${modifiee ? 'bg-amber-50' : ''}`}
                  >
                    <td className="py-2 font-semibold text-gray-900">
                      {carcasse?.numero_bracelet ?? carcasseId}
                    </td>
                    <td className="py-2 pr-3">
                      <ChampSelect
                        aria-label={`Site pour ${carcasse?.numero_bracelet ?? carcasseId}`}
                        value={reglage.site_prelevement}
                        onChange={(event) =>
                          onExceptions({
                            ...exceptions,
                            [carcasseId]: {
                              ...reglage,
                              site_prelevement: event.target.value as TrichineSitePrelevement,
                            },
                          })
                        }
                      >
                        {Object.values(TrichineSitePrelevement).map((site) => (
                          <option
                            key={site}
                            value={site}
                          >
                            {sitePrelevementLabels[site]}
                          </option>
                        ))}
                      </ChampSelect>
                    </td>
                    <td className="w-28 py-2 pr-3">
                      <ChampTexte
                        type="number"
                        min={1}
                        aria-label={`Masse pour ${carcasse?.numero_bracelet ?? carcasseId}`}
                        value={reglage.masse_grammes}
                        onChange={(event) =>
                          onExceptions({
                            ...exceptions,
                            [carcasseId]: { ...reglage, masse_grammes: Number(event.target.value) || 1 },
                          })
                        }
                      />
                    </td>
                    <td className="py-2 text-right">
                      {modifiee && (
                        <Bouton
                          variante="discret"
                          petit
                          onClick={() => {
                            const suivantes = { ...exceptions };
                            delete suivantes[carcasseId];
                            onExceptions(suivantes);
                          }}
                        >
                          Réinitialiser
                        </Bouton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Carte>
  );
}

/* -------------------------------------------------------------------------- */
/* ③ Regroupement                                                              */
/* -------------------------------------------------------------------------- */

function EtapeRegroupement({
  pools,
  parId,
  reglageDe,
  premierDetenteurDe,
  mode,
  modes,
  limites,
  onMode,
  onDeplacer,
}: {
  pools: Array<Array<string>>;
  parId: Map<string, CarcasseAPrelever>;
  reglageDe: (carcasseId: string) => Reglage;
  premierDetenteurDe: (carcasseId: string) => string;
  mode: ModeRegroupement;
  modes: typeof MODES;
  limites: LimitesPool;
  onMode: (mode: ModeRegroupement) => void;
  onDeplacer: (carcasseId: string, indexCible: number) => void;
}) {
  const [survole, setSurvole] = useState<number | null>(null);
  const poolsRemplis = pools.filter((pool) => pool.length > 0);

  // Le glisser-déposer ne marche pas au doigt et ne se pilote pas au clavier :
  // la liste déroulante de chaque carcasse reste le chemin garanti.
  const zoneDepot = (index: number) => ({
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setSurvole(index);
    },
    onDragLeave: () => setSurvole((precedent) => (precedent === index ? null : precedent)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setSurvole(null);
      const carcasseId = event.dataTransfer.getData('text/plain');
      if (carcasseId) onDeplacer(carcasseId, index);
    },
  });

  return (
    <Carte titre="Regroupement">
      <fieldset className="m-0 mb-4 border-0 p-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {modes.map((option) => {
            const actif = mode === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${actif ? 'border-[#000091] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input
                  type="radio"
                  name="mode-regroupement"
                  className="mt-0.5 accent-[#000091]"
                  checked={actif}
                  onChange={() => onMode(option.value)}
                />
                <span>
                  <span className="block font-medium text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-600">{option.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {mode === 'PLUS_TARD' ? (
        <p className="m-0 text-sm text-gray-600">
          Les échantillons seront créés sans pool et apparaîtront comme « à regrouper ». Ils devront l'être
          avant tout envoi au laboratoire.
        </p>
      ) : (
        <>
          <p className="m-0 mb-3 text-sm text-gray-600">
            {poolsRemplis.length} pool{poolsRemplis.length > 1 ? 's' : ''} · glissez une carcasse vers un
            autre pool pour ajuster.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {pools.map((pool, index) => {
              const masses = pool.map((carcasseId) => reglageDe(carcasseId).masse_grammes);
              const erreur = erreurPool(masses, limites);
              const masseTotale = masses.reduce((total, masse) => total + masse, 0);
              const detenteurs = new Set(pool.map(premierDetenteurDe));
              const bordure = erreur ? 'border-red-400 bg-red-50/40' : 'border-gray-200';
              return (
                <div
                  key={index}
                  {...zoneDepot(index)}
                  className={`rounded-lg border p-4 transition ${survole === index ? 'border-[#000091] bg-blue-50' : bordure}`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-sm font-semibold text-gray-900">Pool {index + 1}</p>
                    {erreur ? (
                      <Pastille ton="alerte">{erreur}</Pastille>
                    ) : (
                      <Pastille ton="info">
                        {pool.length} carcasse{pool.length > 1 ? 's' : ''} · {masseTotale} g
                      </Pastille>
                    )}
                  </div>
                  {detenteurs.size === 1 && (
                    <p className="m-0 mb-2 truncate text-xs text-gray-500">{[...detenteurs][0]}</p>
                  )}
                  <ul className="m-0 list-none p-0">
                    {pool.map((carcasseId) => (
                      <li
                        key={carcasseId}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', carcasseId);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        className="flex cursor-grab items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0 active:cursor-grabbing"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-900">
                            {parId.get(carcasseId)?.numero_bracelet ?? carcasseId}
                          </span>
                          <span
                            className="block max-w-56 truncate text-xs text-gray-500"
                            title={parId.get(carcasseId)?.fei_numero}
                          >
                            {detenteurs.size === 1
                              ? parId.get(carcasseId)?.fei_numero
                              : premierDetenteurDe(carcasseId)}
                          </span>
                        </span>
                        <select
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-[#0a76f6]"
                          value={index}
                          aria-label={`Déplacer ${parId.get(carcasseId)?.numero_bracelet ?? carcasseId}`}
                          onChange={(event) => onDeplacer(carcasseId, Number(event.target.value))}
                        >
                          {pools.map((_, cible) => (
                            <option
                              key={cible}
                              value={cible}
                            >
                              Pool {cible + 1}
                            </option>
                          ))}
                          <option value={pools.length}>Nouveau pool</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            <div
              {...zoneDepot(pools.length)}
              className={`flex min-h-24 items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm transition ${survole === pools.length ? 'border-[#000091] bg-blue-50 text-[#000091]' : 'border-gray-300 text-gray-500'}`}
            >
              Déposez une carcasse ici pour créer un nouveau pool
            </div>
          </div>
        </>
      )}
    </Carte>
  );
}

/* -------------------------------------------------------------------------- */
/* ④ Récapitulatif                                                             */
/* -------------------------------------------------------------------------- */

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <p className="m-0 text-xs font-medium tracking-wide text-gray-500 uppercase">{libelle}</p>
      <p className="m-0 mt-1 text-2xl font-bold text-gray-900">{valeur}</p>
    </div>
  );
}

function EtapeRecapitulatif({
  selection,
  pools,
  parId,
  datePrelevement,
  mode,
  limites,
  parent,
  reglageCommun,
  reglageDe,
  nbExceptions,
  premierDetenteurDe,
}: {
  selection: Array<string>;
  pools: Array<Array<string>>;
  parId: Map<string, CarcasseAPrelever>;
  datePrelevement: string;
  mode: ModeRegroupement;
  limites: LimitesPool;
  parent: TrichinePoolPopulated | null;
  reglageCommun: Reglage;
  reglageDe: (carcasseId: string) => Reglage;
  nbExceptions: number;
  premierDetenteurDe: (carcasseId: string) => string;
}) {
  const fiches = new Set(selection.map((id) => parId.get(id)?.fei_numero).filter(Boolean));
  const modeLabel = MODES.find((option) => option.value === mode)?.label ?? '';
  // Dernier écran avant enregistrement : un pool hors limites doit sauter aux yeux ici aussi
  const poolsNonConformes = pools.filter((pool) =>
    erreurPool(
      pool.map((carcasseId) => reglageDe(carcasseId).masse_grammes),
      limites
    )
  ).length;

  return (
    <Carte
      titre="Récapitulatif"
      hint={
        parent
          ? `Les pools créés seront rattachés au pool ${parent.reference_pool} comme analyses de 2e intention.`
          : "Vérifiez avant d'enregistrer : une fois créés, les échantillons se corrigent un par un depuis le suivi."
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre
          valeur={String(selection.length)}
          libelle={`Échantillon${selection.length > 1 ? 's' : ''} à créer`}
        />
        <Chiffre
          valeur={pools.length > 0 ? String(pools.length) : '—'}
          libelle={pools.length > 0 ? modeLabel : 'Pas de regroupement'}
        />
        <Chiffre
          valeur={String(fiches.size)}
          libelle={`Fiche${fiches.size > 1 ? 's' : ''} concernée${fiches.size > 1 ? 's' : ''}`}
        />
        <Chiffre
          valeur={dayjs(datePrelevement).format('DD/MM/YYYY')}
          libelle="Date de prélèvement"
        />
      </div>

      <p className="m-0 mt-3 text-sm text-gray-600">
        Prélèvement sur <strong>{sitePrelevementLabels[reglageCommun.site_prelevement].toLowerCase()}</strong>
        , <strong>{reglageCommun.masse_grammes} g</strong> par carcasse
        {nbExceptions > 0 && (
          <>
            {' '}
            — sauf {nbExceptions} carcasse{nbExceptions > 1 ? 's' : ''} ajustée
            {nbExceptions > 1 ? 's' : ''} individuellement
          </>
        )}
        .
      </p>

      {poolsNonConformes > 0 && (
        <p className="m-0 mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {poolsNonConformes} pool{poolsNonConformes > 1 ? 's' : ''} dépasse
          {poolsNonConformes > 1 ? 'nt' : ''} les limites réglementaires ({TRICHINE_POOL_MAX_CARCASSES}{' '}
          carcasses, {TRICHINE_POOL_MAX_MASSE_GRAMMES} g). Revenez à l'étape 3 pour les corriger.
        </p>
      )}

      {pools.length === 0 ? (
        <p className="m-0 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Aucun regroupement : les échantillons resteront « à regrouper » et devront l'être avant tout envoi
          au laboratoire.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {pools.map((pool, index) => {
            const masses = pool.map((carcasseId) => reglageDe(carcasseId).masse_grammes);
            const erreur = erreurPool(masses);
            const masseTotale = masses.reduce((total, masse) => total + masse, 0);
            const detenteurs = new Set(pool.map(premierDetenteurDe));
            return (
              <div
                key={index}
                className={`rounded-lg border p-3 ${erreur ? 'border-red-400 bg-red-50/40' : 'border-gray-200'}`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-sm font-semibold text-gray-900">Pool {index + 1}</p>
                  {erreur ? (
                    <Pastille ton="alerte">{erreur}</Pastille>
                  ) : (
                    <Pastille ton="info">
                      {pool.length} carcasse{pool.length > 1 ? 's' : ''} · {masseTotale} g
                    </Pastille>
                  )}
                </div>
                {detenteurs.size === 1 && (
                  <p className="m-0 mb-2 truncate text-xs text-gray-500">{[...detenteurs][0]}</p>
                )}
                {/* Numéros de marquage en pastilles : c'est la liste qu'on relit tube par tube */}
                <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
                  {pool.map((carcasseId) => (
                    <li
                      key={carcasseId}
                      className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800"
                    >
                      {parId.get(carcasseId)?.numero_bracelet ?? carcasseId}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="m-0 mt-4 text-xs text-gray-500">
        Les références des échantillons et des pools seront attribuées à l'enregistrement.
      </p>
    </Carte>
  );
}

/* -------------------------------------------------------------------------- */
/* Écran de fin                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Les références de pool sont le vrai produit de l'assistant : elles seront recopiées sur
 * les tubes et citées au laboratoire. Elles sont donc mises en avant et copiables, et la
 * suite du parcours (envoi au labo) est proposée avec les pools déjà pré-sélectionnés.
 */
const SUITE = [
  "Vous créez la fiche de transmission et l'imprimez pour la joindre au colis.",
  "Le laboratoire confirme la réception à l'arrivée du colis.",
  'Le résultat revient dans Zacharie, par pool.',
];

function EcranFinal({
  basePath,
  echantillons,
  pools,
  datePrelevement,
  parent,
  onRecommencer,
}: {
  basePath: string;
  echantillons: number;
  pools: Array<{ id: string; reference: string; carcasses: number }>;
  datePrelevement: string;
  /** Pool mère quand le lot vient d'une 2e intention */
  parent: TrichinePoolPopulated | null;
  onRecommencer: () => void;
}) {
  const copier = (texte: string) => {
    navigator.clipboard
      .writeText(texte)
      .then(() => toast.success(`${texte} copié`))
      .catch(() => toast.error('Copie impossible'));
  };

  return (
    <div className="w-full py-8">
      <title>Prélèvement enregistré | Zacharie</title>
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <span
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700"
            aria-hidden
          >
            ✓
          </span>
          <h1 className="m-0 text-2xl font-bold text-gray-900">
            {parent ? 'Analyses de 2e intention enregistrées' : 'Prélèvement enregistré'}
          </h1>
          <p className="m-0 mt-2 text-sm text-gray-600">
            {echantillons} échantillon{echantillons > 1 ? 's' : ''} prélevé
            {echantillons > 1 ? 's' : ''} le {dayjs(datePrelevement).format('DD/MM/YYYY')}
            {pools.length > 0 && (
              <>
                , regroupé{echantillons > 1 ? 's' : ''} en {pools.length} pool
                {pools.length > 1 ? 's' : ''}
                {parent && (
                  <>
                    {' '}
                    rattaché{pools.length > 1 ? 's' : ''} au pool {parent.reference_pool}
                  </>
                )}
              </>
            )}
            .
          </p>
        </div>

        {pools.length > 0 ? (
          <div className="mt-8">
            <p className="m-0 mb-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Références à reporter sur vos prélèvements
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pools.map((pool) => (
                <div
                  key={pool.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <span>
                    <span className="block font-mono text-lg font-bold tracking-wide text-gray-900">
                      {pool.reference}
                    </span>
                    <span className="block text-xs text-gray-600">
                      {pool.carcasses} carcasse{pool.carcasses > 1 ? 's' : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copier(pool.reference)}
                    title="Copier la référence"
                    aria-label={`Copier ${pool.reference}`}
                    className="shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Copier
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="m-0 text-sm text-amber-900">
              Les échantillons sont enregistrés mais pas encore regroupés. Ils apparaissent comme « à
              regrouper » et devront l'être avant tout envoi au laboratoire.
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-gray-200 pt-6">
          <p className="m-0 mb-4 text-xs font-semibold tracking-wide text-gray-500 uppercase">Et ensuite</p>
          {/* Pas de <ol> : les styles de liste globaux rajouteraient leur propre numérotation */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SUITE.map((texte, index) => (
              <div
                key={texte}
                className="flex gap-3"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <p className="m-0 text-sm text-gray-700">{texte}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {pools.length > 0 && (
            <Link
              to={`${basePath}/nouvelle-ftp?pools=${pools.map((pool) => pool.id).join(',')}`}
              className="rounded bg-[#000091] px-5 py-2.5 text-sm font-medium text-white no-underline hover:opacity-90"
            >
              Créer la fiche de transmission
            </Link>
          )}
          <Link
            to={`${basePath}/echantillons`}
            className="rounded border border-[#000091] bg-white px-5 py-2.5 text-sm font-medium text-[#000091] no-underline hover:bg-gray-50"
          >
            Voir les échantillons
          </Link>
          {parent ? (
            <Link
              to={`${basePath}/pools/${parent.reference_pool}`}
              className="rounded border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 no-underline hover:bg-gray-50"
            >
              Retour au pool {parent.reference_pool}
            </Link>
          ) : (
            <Bouton
              variante="discret"
              onClick={onRecommencer}
            >
              Prélever un autre lot
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );
}
