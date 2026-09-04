import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Chargement from '@app/components/Chargement';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  createTrichineFTP,
  getTrichineFTPs,
  getTrichineLaboratoires,
  getTrichinePools,
  type TrichineLaboratoire,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import { poolSansFTP } from '@app/utils/trichine';

/** Échantillons vivants d'un pool : ce que le laboratoire recevra réellement. */
function echantillonsDuPool(pool: TrichinePoolPopulated) {
  return pool.TrichineEchantillons.filter((echantillon) => !echantillon.deleted_at);
}

function carcassesDuPool(pool: TrichinePoolPopulated): number {
  return new Set(echantillonsDuPool(pool).map((echantillon) => echantillon.zacharie_carcasse_id)).size;
}

/**
 * Création d'une FTP : sélection des pools à envoyer + choix du laboratoire (LVD).
 * La FTP est créée en brouillon puis envoyée depuis son détail.
 *
 * Écran en deux colonnes : à gauche les pools qui attendent un envoi, à droite la fiche en cours.
 */
export default function TrichineNouvelleFTP() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [chargement, setChargement] = useState(true);
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [laboratoires, setLaboratoires] = useState<Array<TrichineLaboratoire>>([]);
  const [recherche, setRecherche] = useState('');
  // Pré-sélection quand on arrive depuis la liste des pools ou de l'assistant de prélèvement
  const [searchParams] = useSearchParams();
  const [preselection] = useState<Array<string>>(() =>
    (searchParams.get('pools') ?? '').split(',').filter(Boolean)
  );
  const [selectedPoolIds, setSelectedPoolIds] = useState<Array<string>>(preselection);
  const [laboratoireId, setLaboratoireId] = useState('');
  // Destinataire de la dernière FTP : on envoie presque toujours au même laboratoire
  const [dernierLaboratoireId, setDernierLaboratoireId] = useState('');
  const [modeTransport, setModeTransport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    Promise.all([getTrichinePools(), getTrichineLaboratoires(), getTrichineFTPs()])
      .then(([poolsResponse, laboratoiresResponse, ftpsResponse]) => {
        if (poolsResponse.ok && poolsResponse.data) setPools(poolsResponse.data.pools);
        const laboratoiresRecus = laboratoiresResponse.data?.laboratoires ?? [];
        setLaboratoires(laboratoiresRecus);
        // Le laboratoire de la dernière fiche créée est proposé d'emblée, s'il est toujours agréé
        const [derniere] = (ftpsResponse.data?.ftps ?? [])
          .filter((ftp) => !ftp.deleted_at)
          .sort((a, b) => dayjs(b.date_creation).valueOf() - dayjs(a.date_creation).valueOf());
        if (derniere && laboratoiresRecus.some((labo) => labo.id === derniere.destinataire_entity_id)) {
          setDernierLaboratoireId(derniere.destinataire_entity_id);
          setLaboratoireId(derniere.destinataire_entity_id);
        }
      })
      .catch(console.error)
      .finally(() => setChargement(false));
  }, []);

  const poolsDisponibles = useMemo(() => pools.filter(poolSansFTP), [pools]);

  // La fiche en construction, colonne de droite. Une pré-sélection peut contenir des pools
  // entre-temps transmis : ils ne sont plus disponibles, on les ignore.
  const selectedPools = useMemo(
    () => poolsDisponibles.filter((pool) => selectedPoolIds.includes(pool.id)),
    [poolsDisponibles, selectedPoolIds]
  );

  // Ce qui reste à transmettre, colonne de gauche : un pool retenu quitte la liste
  const disponibles = useMemo(
    () => poolsDisponibles.filter((pool) => !selectedPoolIds.includes(pool.id)),
    [poolsDisponibles, selectedPoolIds]
  );

  const visibles = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return disponibles;
    return disponibles.filter((pool) => pool.reference_pool.toLowerCase().includes(terme));
  }, [disponibles, recherche]);

  const totalEchantillons = selectedPools.reduce((total, pool) => total + echantillonsDuPool(pool).length, 0);
  const totalCarcasses = selectedPools.reduce((total, pool) => total + carcassesDuPool(pool), 0);

  const preselectionIgnoree = chargement
    ? 0
    : preselection.filter((id) => !poolsDisponibles.some((pool) => pool.id === id)).length;

  const ajouter = (poolId: string) => setSelectedPoolIds((previous) => [...previous, poolId]);
  const retirer = (poolId: string) =>
    setSelectedPoolIds((previous) => previous.filter((id) => id !== poolId));

  if (chargement) return <Chargement />;

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Nouvelle FTP | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-11 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-1w">Nouvelle fiche de transmission des prélèvements (FTP)</h1>
          <p className="fr-text--sm fr-mb-3w text-gray-600">
            Une FTP accompagne les pools jusqu'au laboratoire. Elle est créée en brouillon : vous l'imprimerez
            et l'enverrez depuis son détail.
          </p>

          {preselectionIgnoree > 0 && (
            <Alert
              severity="info"
              small
              className="fr-mb-2w"
              description={`${preselectionIgnoree} pool${preselectionIgnoree > 1 ? 's' : ''} de votre sélection n'${preselectionIgnoree > 1 ? 'apparaissent' : 'apparaît'} pas ici : déjà rattaché${preselectionIgnoree > 1 ? 's' : ''} à une FTP entre-temps.`}
            />
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded bg-white p-4 md:p-6 md:shadow-sm lg:col-span-2">
              <div className="fr-mb-2w flex flex-wrap items-end justify-between gap-4">
                <h2 className="fr-h6 fr-mb-0">À transmettre ({disponibles.length})</h2>
                <Button
                  type="button"
                  size="small"
                  priority="secondary"
                  disabled={!disponibles.length}
                  onClick={() => setSelectedPoolIds(poolsDisponibles.map((pool) => pool.id))}
                >
                  Tout ajouter
                </Button>
              </div>

              {poolsDisponibles.length === 0 ? (
                <p className="fr-text--sm fr-mb-0 py-8 text-center text-gray-600">
                  Aucun pool disponible : tous vos pools sont déjà rattachés à une FTP, ou vous n'avez pas
                  encore créé de pool.
                </p>
              ) : (
                <>
                  <Input
                    label="Rechercher"
                    hintText="Référence de pool"
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
                        ? 'Aucun pool ne correspond à votre recherche.'
                        : 'Tous les pools disponibles sont dans la fiche.'}
                    </p>
                  ) : (
                    <div className="max-h-[32rem] overflow-y-auto border-t border-gray-200">
                      <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b border-gray-300 text-left text-xs tracking-wide text-gray-600 uppercase">
                            <th className="py-2 font-medium">Référence</th>
                            <th className="py-2 font-medium whitespace-nowrap">Échantillons</th>
                            <th className="py-2 font-medium whitespace-nowrap">Carcasses</th>
                            <th className="py-2 font-medium whitespace-nowrap">Constitué le</th>
                            <th className="w-10 py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {visibles.map((pool) => (
                            <tr
                              key={pool.id}
                              className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                              onClick={() => ajouter(pool.id)}
                            >
                              <td className="py-2 font-semibold text-gray-900">{pool.reference_pool}</td>
                              <td className="py-2 whitespace-nowrap text-gray-600">
                                {echantillonsDuPool(pool).length}
                              </td>
                              <td className="py-2 whitespace-nowrap text-gray-600">
                                {carcassesDuPool(pool)}
                              </td>
                              <td className="py-2 whitespace-nowrap text-gray-600">
                                {dayjs(pool.date_constitution).format('DD/MM/YYYY')}
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  aria-label={`Ajouter le pool ${pool.reference_pool} à la fiche`}
                                  className="text-action-high-blue-france rounded px-2 text-lg leading-none font-bold hover:bg-gray-100"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    ajouter(pool.id);
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
              <div className="fr-mb-2w flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="fr-h6 fr-mb-0">Dans la fiche ({selectedPools.length})</h2>
                {selectedPools.length > 0 && (
                  <Button
                    type="button"
                    size="small"
                    priority="tertiary no outline"
                    onClick={() => setSelectedPoolIds([])}
                  >
                    Tout retirer
                  </Button>
                )}
              </div>

              {selectedPools.length === 0 ? (
                <p className="fr-text--sm fr-mb-2w py-4 text-gray-600">
                  Aucun pool pour l'instant. Ajoutez-les depuis la liste : une même fiche peut en porter
                  plusieurs pour un même laboratoire.
                </p>
              ) : (
                <>
                  <ul className="fr-mb-2w m-0 max-h-80 list-none overflow-y-auto p-0">
                    {selectedPools.map((pool) => (
                      <li
                        key={pool.id}
                        className="flex items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-0"
                      >
                        <span className="min-w-0 text-sm">
                          <span className="block font-semibold text-gray-900">{pool.reference_pool}</span>
                          <span className="block text-gray-600">
                            {echantillonsDuPool(pool).length} échantillon
                            {echantillonsDuPool(pool).length > 1 ? 's' : ''} · {carcassesDuPool(pool)}{' '}
                            carcasse{carcassesDuPool(pool) > 1 ? 's' : ''}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Retirer le pool ${pool.reference_pool} de la fiche`}
                          className="rounded px-2 text-lg leading-none text-gray-600 hover:bg-gray-100 hover:text-red-700"
                          onClick={() => retirer(pool.id)}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="fr-text--sm fr-mb-2w border-t border-gray-200 pt-4 text-gray-700">
                    Total : <strong>{totalEchantillons}</strong> échantillon
                    {totalEchantillons > 1 ? 's' : ''} · <strong>{totalCarcasses}</strong> carcasse
                    {totalCarcasses > 1 ? 's' : ''}
                  </p>
                </>
              )}

              <Select
                label="Laboratoire destinataire (LVD agréé)"
                nativeSelectProps={{
                  value: laboratoireId,
                  onChange: (event) => setLaboratoireId(event.target.value),
                }}
              >
                <option value="">Sélectionnez un laboratoire</option>
                {laboratoires.map((laboratoire) => (
                  <option
                    key={laboratoire.id}
                    value={laboratoire.id}
                  >
                    {laboratoire.nom_d_usage || laboratoire.raison_sociale}
                    {laboratoire.ville ? ` — ${laboratoire.ville}` : ''}
                  </option>
                ))}
              </Select>
              <Input
                label="Mode de transport (optionnel)"
                nativeInputProps={{
                  type: 'text',
                  placeholder: 'Ex : dépôt direct, transporteur, voie postale…',
                  value: modeTransport,
                  onChange: (event) => setModeTransport(event.target.value),
                }}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!selectedPools.length || !laboratoireId || isSubmitting}
                  onClick={() => {
                    setIsSubmitting(true);
                    createTrichineFTP({
                      pool_ids: selectedPools.map((pool) => pool.id),
                      destinataire_entity_id: laboratoireId,
                      mode_transport: modeTransport.trim() || undefined,
                    })
                      .then((response) => {
                        if (response.ok && response.data) {
                          toast.success(`FTP ${response.data.ftp.numero_fiche} créée`);
                          navigate(`${basePath}/ftp/${response.data.ftp.numero_fiche}`);
                        } else {
                          toast.error(response.error || 'Une erreur est survenue');
                        }
                      })
                      .catch(() => toast.error('Une erreur est survenue'))
                      .finally(() => setIsSubmitting(false));
                  }}
                >
                  {selectedPools.length
                    ? `Créer la FTP (${selectedPools.length} pool${selectedPools.length > 1 ? 's' : ''})`
                    : 'Créer la FTP'}
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
