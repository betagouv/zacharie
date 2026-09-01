import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse, TrichineType } from '@prisma/client';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  createTrichinePool,
  getTrichineEchantillons,
  getTrichinePools,
  type TrichineEchantillonWithCarcasse,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import { TRICHINE_POOL_MAX_CARCASSES, TRICHINE_POOL_MAX_MASSE_GRAMMES } from '@app/utils/trichine';
import {
  erreurPool,
  LIMITES_POOL_FILLE,
  LIMITES_POOL_INITIAL,
  LIMITES_POOL_PETITE_FILLE,
} from '@app/utils/trichine-repartition';

/**
 * Création d'un pool à partir d'échantillons déjà prélevés mais pas encore regroupés
 * (max 19 carcasses / 100 g, cf doc/trichine.md §9). Le pool est initial par défaut ; rattaché
 * à un pool douteux, c'est une analyse de 2e intention et les limites du rang s'appliquent.
 */
export default function TrichineNouveauPool() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [echantillons, setEchantillons] = useState<Array<TrichineEchantillonWithCarcasse>>([]);
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [parentId, setParentId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Array<string>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getTrichineEchantillons({ sansPool: true })
      .then((response) => response.ok && response.data && setEchantillons(response.data.echantillons))
      .catch(console.error);
    getTrichinePools()
      .then((response) => response.ok && response.data && setPools(response.data.pools))
      .catch(console.error);
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

  const selected = useMemo(
    () => echantillonsProposes.filter((echantillon) => selectedIds.includes(echantillon.id)),
    [echantillonsProposes, selectedIds]
  );
  // Une carcasse peut porter plusieurs échantillons : les limites se comptent par carcasse
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
  const masseTotale = massesParCarcasse.reduce((sum, masse) => sum + masse, 0);

  const erreur = selected.length ? erreurPool(massesParCarcasse, limites) : null;

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Nouveau pool | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Nouveau pool</h1>
          <div className="rounded bg-white p-4 md:p-8 md:shadow-sm">
            {parentsPossibles.length > 0 && (
              <Select
                label="Pool de rattachement"
                hint="Un pool rattaché à un pool douteux est une analyse de 2e intention."
                nativeSelectProps={{
                  value: parentId,
                  onChange: (event) => {
                    setParentId(event.target.value);
                    // Les échantillons proposés changent avec le rang : la sélection repart de zéro
                    setSelectedIds([]);
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
            )}
            <p className="fr-text--sm">
              {parent
                ? `Sélectionnez les prélèvements complémentaires à analyser ensemble (${limites.maxCarcasses} carcasse(s) du pool ${parent.reference_pool}${limites.minMasse ? `, ${limites.minMasse} g minimum` : ''}).`
                : `Sélectionnez les échantillons à analyser ensemble (${TRICHINE_POOL_MAX_CARCASSES} carcasses et ${TRICHINE_POOL_MAX_MASSE_GRAMMES} g maximum).`}
            </p>
            {echantillonsProposes.length === 0 ? (
              <p className="fr-text--sm">
                {parent
                  ? `Aucun prélèvement complémentaire en attente sur les carcasses du pool ${parent.reference_pool}. Réalisez-les depuis le pool douteux.`
                  : "Aucun échantillon disponible. Créez d'abord un échantillon depuis la page d'une carcasse de sanglier."}
              </p>
            ) : (
              <Checkbox
                legend={`Échantillons sélectionnés : ${selectedIds.length} (${nbCarcasses} carcasse(s), ${masseTotale} g)`}
                options={echantillonsProposes.map((echantillon) => ({
                  label: `${echantillon.reference_echantillon} — carcasse ${echantillon.Carcasse.numero_bracelet} — ${echantillon.masse_grammes} g — ${dayjs(echantillon.date_prelevement).format('DD/MM/YYYY')}`,
                  nativeInputProps: {
                    checked: selectedIds.includes(echantillon.id),
                    onChange: (event) => {
                      setSelectedIds((previous) =>
                        event.target.checked
                          ? [...previous, echantillon.id]
                          : previous.filter((id) => id !== echantillon.id)
                      );
                    },
                  },
                }))}
              />
            )}
            {erreur && (
              <Alert
                severity="error"
                small
                description={erreur}
                className="fr-mb-2w"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!selectedIds.length || !!erreur || isSubmitting}
                onClick={() => {
                  setIsSubmitting(true);
                  createTrichinePool({
                    echantillon_ids: selectedIds,
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
                Créer le pool
              </Button>
              <Button
                type="button"
                priority="secondary"
                onClick={() => navigate(-1)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
