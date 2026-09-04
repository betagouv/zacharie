import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse, TrichineType } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import { Pastille } from '@app/components/trichine/wizard-ui';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  createTrichinePool,
  getTrichineEchantillons,
  getTrichinePools,
  type TrichineEchantillonWithCarcasse,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import {
  erreurPool,
  LIMITES_POOL_FILLE,
  LIMITES_POOL_INITIAL,
  LIMITES_POOL_PETITE_FILLE,
  repartirEnPools,
} from '@app/utils/trichine-repartition';

/** Une carcasse et ses prélèvements en attente : les limites du pool se comptent par carcasse. */
type CarcasseProposee = {
  zacharie_carcasse_id: string;
  numero_bracelet: string | null;
  masse_grammes: number;
  echantillons: Array<TrichineEchantillonWithCarcasse>;
};

/**
 * Création d'un pool à partir d'échantillons déjà prélevés mais pas encore regroupés
 * (max 19 carcasses / 100 g, cf doc/trichine.md §9). Le pool est initial par défaut ; rattaché
 * à un pool douteux, c'est une analyse de 2e intention et les limites du rang s'appliquent.
 *
 * Écran en deux colonnes : à gauche ce qui reste à regrouper, à droite le pool en construction.
 */
export default function TrichineNouveauPool() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [chargement, setChargement] = useState(true);
  const [echantillons, setEchantillons] = useState<Array<TrichineEchantillonWithCarcasse>>([]);
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [parentId, setParentId] = useState('');
  const [recherche, setRecherche] = useState('');
  // Pré-sélection quand on arrive depuis la liste des échantillons, déjà dans le pool
  const [searchParams] = useSearchParams();
  const [preselection] = useState<Array<string>>(() =>
    (searchParams.get('echantillons') ?? '').split(',').filter(Boolean)
  );
  const [selectedIds, setSelectedIds] = useState<Array<string>>(preselection);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    Promise.all([
      getTrichineEchantillons({ sansPool: true }).then(
        (response) => response.ok && response.data && setEchantillons(response.data.echantillons)
      ),
      getTrichinePools().then((response) => response.ok && response.data && setPools(response.data.pools)),
    ])
      .catch(console.error)
      .finally(() => setChargement(false));
  }, []);

  // Un pool douteux appelle une 2e intention, tant que la hiérarchie mère / fille / petite-fille
  // n'est pas épuisée. C'est la seule façon de rattacher un pool à un parent depuis cet écran.
  const parentsPossibles = useMemo(
    () =>
      pools.filter(
        (pool) =>
          !pool.deleted_at &&
          pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX &&
          !(pool.pool_parent_id && pools.find((aieul) => aieul.id === pool.pool_parent_id)?.pool_parent_id)
      ),
    [pools]
  );

  const parent = useMemo(
    () => parentsPossibles.find((pool) => pool.id === parentId) ?? null,
    [parentsPossibles, parentId]
  );

  const limites = !parent
    ? LIMITES_POOL_INITIAL
    : parent.pool_parent_id
      ? LIMITES_POOL_PETITE_FILLE
      : LIMITES_POOL_FILLE;

  // Sans parent, on ne regroupe que des prélèvements initiaux ; avec parent, que les
  // complémentaires prélevés sur les carcasses de ce pool.
  const echantillonsProposes = useMemo(() => {
    if (!parent) {
      return echantillons.filter((echantillon) => echantillon.type === TrichineType.INITIAL);
    }
    const carcassesDuParent = new Set(
      parent.TrichineEchantillons.filter((echantillon) => !echantillon.deleted_at).map(
        (echantillon) => echantillon.zacharie_carcasse_id
      )
    );
    return echantillons.filter(
      (echantillon) =>
        echantillon.type === TrichineType.COMPLEMENTAIRE &&
        carcassesDuParent.has(echantillon.zacharie_carcasse_id)
    );
  }, [echantillons, parent]);

  // Une carcasse peut porter plusieurs échantillons : les limites se comptent par carcasse
  const carcassesProposees = useMemo(() => {
    const parCarcasse = new Map<string, CarcasseProposee>();
    for (const echantillon of echantillonsProposes) {
      const carcasse = parCarcasse.get(echantillon.zacharie_carcasse_id);
      if (carcasse) {
        carcasse.masse_grammes += echantillon.masse_grammes;
        carcasse.echantillons.push(echantillon);
      } else {
        parCarcasse.set(echantillon.zacharie_carcasse_id, {
          zacharie_carcasse_id: echantillon.zacharie_carcasse_id,
          numero_bracelet: echantillon.Carcasse.numero_bracelet,
          masse_grammes: echantillon.masse_grammes,
          echantillons: [echantillon],
        });
      }
    }
    return [...parCarcasse.values()];
  }, [echantillonsProposes]);

  // Le pool en construction, colonne de droite
  const selected = useMemo(
    () => echantillonsProposes.filter((echantillon) => selectedIds.includes(echantillon.id)),
    [echantillonsProposes, selectedIds]
  );

  // Ce qui reste à regrouper, colonne de gauche : un échantillon retenu quitte la liste
  const disponibles = useMemo(
    () => echantillonsProposes.filter((echantillon) => !selectedIds.includes(echantillon.id)),
    [echantillonsProposes, selectedIds]
  );

  const visibles = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return disponibles;
    return disponibles.filter((echantillon) =>
      `${echantillon.reference_echantillon} ${echantillon.Carcasse.numero_bracelet ?? ''}`
        .toLowerCase()
        .includes(terme)
    );
  }, [disponibles, recherche]);

  const massesParCarcasse = useMemo(() => {
    const total = new Map<string, number>();
    for (const echantillon of selected) {
      total.set(
        echantillon.zacharie_carcasse_id,
        (total.get(echantillon.zacharie_carcasse_id) ?? 0) + echantillon.masse_grammes
      );
    }
    return [...total.values()];
  }, [selected]);
  const nbCarcasses = massesParCarcasse.length;
  const masseTotale = massesParCarcasse.reduce((total, masse) => total + masse, 0);

  const erreur = selected.length ? erreurPool(massesParCarcasse, limites) : null;

  // Pré-sélection devenue caduque (échantillon regroupé entre-temps) : on le dit. Choisir un
  // pool de rattachement vide de toute façon la sélection, l'avertissement n'a plus lieu d'être.
  const preselectionIgnoree =
    chargement || parent
      ? 0
      : preselection.filter((id) => !echantillonsProposes.some((echantillon) => echantillon.id === id))
          .length;

  const ajouter = (echantillonId: string) => setSelectedIds((previous) => [...previous, echantillonId]);
  const retirer = (echantillonId: string) =>
    setSelectedIds((previous) => previous.filter((id) => id !== echantillonId));

  // Remplit le pool jusqu'aux limites du rang, sans défaire ce qui est déjà retenu
  const remplir = () => {
    const dejaRetenues = new Set(selected.map((echantillon) => echantillon.zacharie_carcasse_id));
    const ordonnees = [...carcassesProposees].sort(
      (a, b) =>
        Number(dejaRetenues.has(b.zacharie_carcasse_id)) - Number(dejaRetenues.has(a.zacharie_carcasse_id))
    );
    const [premierPool = []] = repartirEnPools(ordonnees, limites);
    const retenues = new Set(premierPool);
    setSelectedIds(
      ordonnees
        .filter((carcasse) => retenues.has(carcasse.zacharie_carcasse_id))
        .flatMap((carcasse) => carcasse.echantillons.map((echantillon) => echantillon.id))
    );
  };

  if (chargement) return <Chargement />;

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Nouveau pool | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-11 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-1w">Nouveau pool</h1>
          <p className="fr-text--sm fr-mb-3w text-gray-600">
            {parent
              ? `Analyse de 2e intention : regroupez les prélèvements complémentaires réalisés sur les carcasses du pool ${parent.reference_pool}.`
              : 'Le laboratoire analyse le pool en une fois : un résultat défavorable concernera toutes les carcasses qui le composent.'}
          </p>

          {parentsPossibles.length > 0 && (
            <div className="fr-mb-2w rounded bg-white p-4 md:p-6 md:shadow-sm">
              <Select
                label="Pool de rattachement"
                hint="Un pool rattaché à un pool douteux est une analyse de 2e intention."
                className="fr-mb-0"
                nativeSelectProps={{
                  value: parentId,
                  onChange: (event) => {
                    setParentId(event.target.value);
                    // Les échantillons proposés changent avec le rang : le pool repart de zéro
                    setSelectedIds([]);
                    setRecherche('');
                  },
                }}
              >
                <option value="">Aucun — pool initial</option>
                {parentsPossibles.map((pool) => (
                  <option
                    key={pool.id}
                    value={pool.id}
                  >
                    Pool {pool.reference_pool} (douteux) — {pool.pool_parent_id ? 'petite-fille' : 'fille'}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {preselectionIgnoree > 0 && (
            <Alert
              severity="info"
              small
              className="fr-mb-2w"
              description={`${preselectionIgnoree} échantillon${preselectionIgnoree > 1 ? 's' : ''} de votre sélection n'${preselectionIgnoree > 1 ? 'apparaissent' : 'apparaît'} pas ici : déjà regroupé${preselectionIgnoree > 1 ? 's' : ''} dans un pool entre-temps.`}
            />
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded bg-white p-4 md:p-6 md:shadow-sm lg:col-span-2">
              <div className="fr-mb-2w flex flex-wrap items-end justify-between gap-4">
                <h2 className="fr-h6 fr-mb-0">À regrouper ({disponibles.length})</h2>
                <Button
                  type="button"
                  size="small"
                  priority="secondary"
                  disabled={!disponibles.length}
                  onClick={remplir}
                  title={`Retient des carcasses jusqu'aux limites du pool (${limites.maxCarcasses} carcasse(s)${limites.maxMasse ? `, ${limites.maxMasse} g` : ''})`}
                >
                  Remplir le pool
                </Button>
              </div>

              {echantillonsProposes.length === 0 ? (
                <p className="fr-text--sm fr-mb-0 py-8 text-center text-gray-600">
                  {parent
                    ? `Aucun prélèvement complémentaire en attente sur les carcasses du pool ${parent.reference_pool}. Réalisez-les depuis le pool douteux.`
                    : "Aucun échantillon en attente de regroupement. Prélevez d'abord une carcasse de sanglier."}
                </p>
              ) : (
                <>
                  <Input
                    label="Rechercher"
                    hintText="Référence d'échantillon, n° de marquage"
                    className="fr-mb-2w"
                    nativeInputProps={{
                      type: 'search',
                      value: recherche,
                      placeholder: 'Référence…',
                      onChange: (event) => setRecherche(event.target.value),
                    }}
                  />
                  {visibles.length === 0 ? (
                    <p className="fr-text--sm fr-mb-0 py-8 text-center text-gray-500">
                      {disponibles.length
                        ? 'Aucun échantillon ne correspond à votre recherche.'
                        : 'Tous les échantillons proposés sont dans le pool.'}
                    </p>
                  ) : (
                    <div className="max-h-[32rem] overflow-y-auto border-t border-gray-200">
                      <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b border-gray-300 text-left text-xs tracking-wide text-gray-600 uppercase">
                            <th className="py-2 font-medium">Référence</th>
                            <th className="py-2 font-medium">N° de marquage</th>
                            <th className="py-2 font-medium whitespace-nowrap">Masse</th>
                            <th className="py-2 font-medium whitespace-nowrap">Prélevé le</th>
                            <th className="w-10 py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {visibles.map((echantillon) => (
                            <tr
                              key={echantillon.id}
                              className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                              onClick={() => ajouter(echantillon.id)}
                            >
                              <td className="py-2 font-semibold text-gray-900">
                                {echantillon.reference_echantillon}
                              </td>
                              <td className="py-2 text-gray-600">{echantillon.Carcasse.numero_bracelet}</td>
                              <td className="py-2 whitespace-nowrap text-gray-600">
                                {echantillon.masse_grammes} g
                              </td>
                              <td className="py-2 whitespace-nowrap text-gray-600">
                                {dayjs(echantillon.date_prelevement).format('DD/MM/YYYY')}
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  aria-label={`Ajouter ${echantillon.reference_echantillon} au pool`}
                                  className="text-action-high-blue-france rounded px-2 text-lg leading-none font-bold hover:bg-gray-100"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    ajouter(echantillon.id);
                                  }}
                                >
                                  +
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="h-fit rounded bg-white p-4 md:p-6 md:shadow-sm lg:sticky lg:top-4">
              <div className="fr-mb-2w border-b border-gray-200 pb-4">
                <Jauge
                  label="Carcasses"
                  valeur={nbCarcasses}
                  maximum={limites.maxCarcasses}
                  unite=""
                />
                {limites.maxMasse ? (
                  <div className="fr-mt-2w">
                    <Jauge
                      label="Masse"
                      valeur={masseTotale}
                      maximum={limites.maxMasse}
                      unite=" g"
                    />
                  </div>
                ) : (
                  <p className="fr-text--sm fr-mt-2w fr-mb-0 text-gray-700">
                    Masse : <strong>{masseTotale} g</strong>
                    {!!limites.minMasse && ` — minimum ${limites.minMasse} g`}
                  </p>
                )}
              </div>
              <div className="fr-mb-2w flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="fr-h6 fr-mb-0">Dans le pool ({selected.length})</h2>
                {selected.length > 0 && (
                  <Button
                    type="button"
                    size="small"
                    priority="tertiary no outline"
                    onClick={() => setSelectedIds([])}
                  >
                    Tout retirer
                  </Button>
                )}
              </div>

              {selected.length === 0 ? (
                <p className="fr-text--sm fr-mb-2w py-4 text-gray-600">
                  Aucun échantillon pour l'instant. Ajoutez-les depuis la liste, ou laissez « Remplir le pool
                  » les retenir jusqu'aux limites réglementaires.
                </p>
              ) : (
                <ul className="fr-mb-2w m-0 max-h-80 list-none overflow-y-auto p-0">
                  {selected.map((echantillon) => {
                    const memeCarcasse = selected.filter(
                      (autre) => autre.zacharie_carcasse_id === echantillon.zacharie_carcasse_id
                    ).length;
                    return (
                      <li
                        key={echantillon.id}
                        className="flex items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-0"
                      >
                        <span className="min-w-0 text-sm">
                          <span className="block font-semibold text-gray-900">
                            {echantillon.reference_echantillon}
                          </span>
                          <span className="block text-gray-600">
                            {echantillon.Carcasse.numero_bracelet} · {echantillon.masse_grammes} g
                          </span>
                          {memeCarcasse > 1 && (
                            <Pastille ton="info">{memeCarcasse} prélèvements — 1 seule carcasse</Pastille>
                          )}
                        </span>
                        <button
                          type="button"
                          aria-label={`Retirer ${echantillon.reference_echantillon} du pool`}
                          className="rounded px-2 text-lg leading-none text-gray-600 hover:bg-gray-100 hover:text-red-700"
                          onClick={() => retirer(echantillon.id)}
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {erreur && (
                <Alert
                  severity="error"
                  small
                  className="fr-mb-2w"
                  description={erreur}
                />
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!selected.length || !!erreur || isSubmitting}
                  onClick={() => {
                    setIsSubmitting(true);
                    createTrichinePool({
                      echantillon_ids: selected.map((echantillon) => echantillon.id),
                      pool_parent_id: parent?.id,
                    })
                      .then((response) => {
                        if (response.ok && response.data) {
                          toast.success(`Pool ${response.data.pool.reference_pool} créé`);
                          navigate(`${basePath}/pools/${response.data.pool.reference_pool}`);
                        } else {
                          toast.error(response.error || 'Une erreur est survenue');
                        }
                      })
                      .catch(() => toast.error('Une erreur est survenue'))
                      .finally(() => setIsSubmitting(false));
                  }}
                >
                  {nbCarcasses
                    ? `Créer le pool (${nbCarcasses} carcasse${nbCarcasses > 1 ? 's' : ''})`
                    : 'Créer le pool'}
                </Button>
                <Button
                  type="button"
                  priority="secondary"
                  onClick={() => navigate(-1)}
                >
                  Annuler
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Ce que contient le pool en construction, face aux limites de son rang : le nombre de carcasses
 * et la masse sont les deux seules contraintes réglementaires, on les montre en continu.
 */
function Jauge({
  label,
  valeur,
  maximum,
  unite,
}: {
  label: string;
  valeur: number;
  maximum: number;
  unite: string;
}) {
  const depasse = valeur > maximum;
  return (
    <div>
      <p className="fr-text--sm fr-mb-1v flex justify-between text-gray-700">
        <span>{label}</span>
        <span className={depasse ? 'font-semibold text-red-700' : 'font-semibold'}>
          {valeur}
          {unite} / {maximum}
          {unite}
        </span>
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded bg-gray-200">
        <div
          className={`h-full ${depasse ? 'bg-red-600' : 'bg-[#000091]'}`}
          style={{ width: `${Math.min(100, (valeur / maximum) * 100)}%` }}
        />
      </div>
    </div>
  );
}
