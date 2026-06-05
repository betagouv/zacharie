import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import {
  createTrichinePool,
  getTrichineEchantillons,
  type TrichineEchantillonWithCarcasse,
} from '@app/services/trichine';
import { TRICHINE_POOL_MAX_CARCASSES, TRICHINE_POOL_MAX_MASSE_GRAMMES } from '@app/utils/trichine';

/**
 * Création d'un pool initial : sélection d'échantillons sans pool
 * (max 19 carcasses / 100 g, cf doc/trichine.md §9).
 */
export default function ChasseurTrichineNouveauPool() {
  const navigate = useNavigate();
  const [echantillons, setEchantillons] = useState<Array<TrichineEchantillonWithCarcasse>>([]);
  const [selectedIds, setSelectedIds] = useState<Array<string>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getTrichineEchantillons({ sansPool: true })
      .then((response) => response.ok && response.data && setEchantillons(response.data.echantillons))
      .catch(console.error);
  }, []);

  const selected = useMemo(
    () => echantillons.filter((echantillon) => selectedIds.includes(echantillon.id)),
    [echantillons, selectedIds]
  );
  const nbCarcasses = useMemo(
    () => new Set(selected.map((echantillon) => echantillon.zacharie_carcasse_id)).size,
    [selected]
  );
  const masseTotale = useMemo(
    () => selected.reduce((sum, echantillon) => sum + echantillon.masse_grammes, 0),
    [selected]
  );

  const erreur =
    nbCarcasses > TRICHINE_POOL_MAX_CARCASSES
      ? `Un pool ne peut pas contenir plus de ${TRICHINE_POOL_MAX_CARCASSES} carcasses`
      : masseTotale > TRICHINE_POOL_MAX_MASSE_GRAMMES
        ? `Un pool ne peut pas dépasser ${TRICHINE_POOL_MAX_MASSE_GRAMMES} g d'échantillons`
        : null;

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Nouveau pool | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Nouveau pool</h1>
          <div className="rounded bg-white p-4 md:p-8 md:shadow-sm">
            <p className="fr-text--sm">
              Sélectionnez les échantillons à analyser ensemble ({TRICHINE_POOL_MAX_CARCASSES} carcasses et{' '}
              {TRICHINE_POOL_MAX_MASSE_GRAMMES} g maximum).
            </p>
            {echantillons.length === 0 ? (
              <p className="fr-text--sm">
                Aucun échantillon disponible. Créez d'abord un échantillon depuis la page d'une carcasse de
                sanglier.
              </p>
            ) : (
              <Checkbox
                legend={`Échantillons sélectionnés : ${selectedIds.length} (${nbCarcasses} carcasse(s), ${masseTotale} g)`}
                options={echantillons.map((echantillon) => ({
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
                  createTrichinePool({ echantillon_ids: selectedIds })
                    .then((response) => {
                      if (response.ok && response.data) {
                        toast.success(`Pool ${response.data.pool.reference_pool} créé`);
                        navigate('/app/chasseur/trichine?tab=pools');
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
