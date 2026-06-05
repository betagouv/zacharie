import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  createTrichineFTP,
  getTrichineLaboratoires,
  getTrichinePools,
  type TrichineLaboratoire,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import { poolSansFTP } from '@app/utils/trichine';

/**
 * Création d'une FTP : sélection des pools à envoyer + choix du laboratoire (LVD).
 * La FTP est créée en brouillon puis envoyée depuis son détail.
 */
export default function TrichineNouvelleFTP() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [laboratoires, setLaboratoires] = useState<Array<TrichineLaboratoire>>([]);
  const [selectedPoolIds, setSelectedPoolIds] = useState<Array<string>>([]);
  const [laboratoireId, setLaboratoireId] = useState('');
  const [modeTransport, setModeTransport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getTrichinePools()
      .then((response) => response.ok && response.data && setPools(response.data.pools))
      .catch(console.error);
    getTrichineLaboratoires()
      .then((response) => response.ok && response.data && setLaboratoires(response.data.laboratoires))
      .catch(console.error);
  }, []);

  const poolsDisponibles = useMemo(() => pools.filter(poolSansFTP), [pools]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Nouvelle FTP | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Nouvelle fiche de transmission des prélèvements (FTP)</h1>
          <div className="rounded bg-white p-4 md:p-8 md:shadow-sm">
            {poolsDisponibles.length === 0 ? (
              <p className="fr-text--sm">
                Aucun pool disponible : tous vos pools sont déjà rattachés à une FTP, ou vous n'avez pas
                encore créé de pool.
              </p>
            ) : (
              <>
                <Checkbox
                  legend={`Pools à transmettre (${selectedPoolIds.length} sélectionné(s))`}
                  options={poolsDisponibles.map((pool) => ({
                    label: `${pool.reference_pool} — ${pool.TrichineEchantillons.length} échantillon(s) — constitué le ${dayjs(pool.date_constitution).format('DD/MM/YYYY')}`,
                    nativeInputProps: {
                      checked: selectedPoolIds.includes(pool.id),
                      onChange: (event) => {
                        setSelectedPoolIds((previous) =>
                          event.target.checked
                            ? [...previous, pool.id]
                            : previous.filter((id) => id !== pool.id)
                        );
                      },
                    },
                  }))}
                />
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
                    disabled={!selectedPoolIds.length || !laboratoireId || isSubmitting}
                    onClick={() => {
                      setIsSubmitting(true);
                      createTrichineFTP({
                        pool_ids: selectedPoolIds,
                        destinataire_entity_id: laboratoireId,
                        mode_transport: modeTransport.trim() || undefined,
                      })
                        .then((response) => {
                          if (response.ok && response.data) {
                            toast.success(`FTP ${response.data.ftp.numero_fiche} créée`);
                            navigate(`${basePath}/ftp/${response.data.ftp.id}`);
                          } else {
                            toast.error(response.error || 'Une erreur est survenue');
                          }
                        })
                        .catch(() => toast.error('Une erreur est survenue'))
                        .finally(() => setIsSubmitting(false));
                    }}
                  >
                    Créer la FTP
                  </Button>
                  <Button
                    type="button"
                    priority="secondary"
                    onClick={() => navigate(-1)}
                  >
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
