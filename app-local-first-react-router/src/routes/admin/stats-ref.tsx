import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { CarcasseType, StatsRefCircuit, StatsRefIndicateur } from '@prisma/client';
import type { AdminStatsRefResponse, AdminStatsRefsResponse } from '@api/src/types/responses';
import { Input } from '@app/components/Input';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';

type StatsRef = AdminStatsRefsResponse['data']['statsRefs'][number];

const CIRCUIT_LABELS: Record<StatsRefCircuit, string> = {
  [StatsRefCircuit.LONG]: 'Circuit long',
  [StatsRefCircuit.COURT]: 'Circuit court',
};

const TYPE_GIBIER_LABELS: Record<CarcasseType, string> = {
  [CarcasseType.GROS_GIBIER]: 'Grand gibier',
  [CarcasseType.PETIT_GIBIER]: 'Petit gibier',
};

const INDICATEUR_LABELS: Record<StatsRefIndicateur, string> = {
  [StatsRefIndicateur.VOLUME_GLOBAL]: 'Volume global (carcasses)',
  [StatsRefIndicateur.OBJECTIF_PART_TRACEE]: 'Objectif de part tracée (%)',
  [StatsRefIndicateur.TAUX_SAISIE]: 'Taux de saisie national (%)',
  [StatsRefIndicateur.TAUX_SAISIE_BPH_HORS_ZACHARIE]: 'Taux de saisie BPH hors Zacharie (%)',
};

// Saisons du 1er juin au 31 mai, de 2020-2021 à deux saisons après la saison en cours (objectifs), la plus
// récente en premier
function getSaisons(): Array<string> {
  const now = dayjs();
  const saisonEnCours = now.month() >= 5 ? now.year() : now.year() - 1;
  const saisons: Array<string> = [];
  for (let debut = saisonEnCours + 2; debut >= 2020; debut--) saisons.push(`${debut}-${debut + 1}`);
  return saisons;
}

const SAISONS = getSaisons();

type FormState = {
  saison: string;
  circuit: StatsRefCircuit;
  type_gibier: CarcasseType;
  indicateur: StatsRefIndicateur;
  valeur: string;
  source: string;
};

const EMPTY_FORM: FormState = {
  saison: '',
  circuit: StatsRefCircuit.LONG,
  type_gibier: CarcasseType.GROS_GIBIER,
  indicateur: StatsRefIndicateur.VOLUME_GLOBAL,
  valeur: '',
  source: '',
};

export default function AdminStatsRef() {
  const [statsRefs, setStatsRefs] = useState<Array<StatsRef>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function loadStatsRefs() {
    return API.get({ path: 'admin/stats-ref' })
      .then((res) => res as AdminStatsRefsResponse)
      .then((res) => {
        if (res.ok) setStatsRefs(res.data.statsRefs);
      });
  }

  useEffect(() => {
    loadStatsRefs().finally(() => setIsLoading(false));
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  }

  function editStatsRef(statsRef: StatsRef) {
    setForm({
      saison: statsRef.saison,
      circuit: statsRef.circuit,
      type_gibier: statsRef.type_gibier,
      indicateur: statsRef.indicateur,
      valeur: String(statsRef.valeur),
      source: statsRef.source ?? '',
    });
    setEditingId(statsRef.id);
    setError(null);
  }

  function saveStatsRef() {
    setError(null);
    setIsSaving(true);
    const body = { ...form, valeur: form.valeur === '' ? null : Number(form.valeur) };
    const request = editingId
      ? API.put({ path: `admin/stats-ref/${editingId}`, body })
      : API.post({ path: 'admin/stats-ref', body });
    request
      .then((res) => res as AdminStatsRefResponse)
      .then((res) => {
        if (!res.ok) return setError(res.error);
        resetForm();
        return loadStatsRefs();
      })
      .finally(() => setIsSaving(false));
  }

  function deleteStatsRef(statsRef: StatsRef) {
    const confirmMessage = `Supprimer la référence ${statsRef.saison} · ${CIRCUIT_LABELS[statsRef.circuit]} · ${TYPE_GIBIER_LABELS[statsRef.type_gibier]} · ${INDICATEUR_LABELS[statsRef.indicateur]} ?`;
    if (!window.confirm(confirmMessage)) return;
    API.delete({ path: `admin/stats-ref/${statsRef.id}` })
      .then((res) => res as AdminStatsRefResponse)
      .then((res) => {
        if (!res.ok) return setError(res.error);
        if (editingId === statsRef.id) resetForm();
        return loadStatsRefs();
      });
  }

  if (isLoading) {
    return <Chargement />;
  }

  const isPourcentage = form.indicateur !== StatsRefIndicateur.VOLUME_GLOBAL;

  return (
    <div className="p-2 md:p-4">
      <title>
        Références stats | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <section className="mb-4 bg-white p-4 md:p-8 md:shadow-sm">
        <h2 className="fr-h4">{editingId ? 'Modifier la référence' : 'Ajouter une référence'}</h2>
        <p className="text-sm text-gray-600">
          Volumes, objectifs et taux nationaux lus par Metabase pour les KPI. Taux et objectifs en pourcentage
          (45 = 45 %).
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveStatsRef();
          }}
        >
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
            <Select
              label="Saison"
              hint="Du 1er juin au 31 mai"
              nativeSelectProps={{
                value: form.saison,
                required: true,
                onChange: (e) => setForm({ ...form, saison: e.currentTarget.value }),
              }}
            >
              <option
                value=""
                disabled
              >
                Choisir une saison
              </option>
              {SAISONS.map((saison) => (
                <option
                  key={saison}
                  value={saison}
                >
                  {saison}
                </option>
              ))}
            </Select>
            <Select
              label="Circuit"
              nativeSelectProps={{
                value: form.circuit,
                onChange: (e) => setForm({ ...form, circuit: e.currentTarget.value as StatsRefCircuit }),
              }}
            >
              {Object.values(StatsRefCircuit).map((circuit) => (
                <option
                  key={circuit}
                  value={circuit}
                >
                  {CIRCUIT_LABELS[circuit]}
                </option>
              ))}
            </Select>
            <Select
              label="Type de gibier"
              nativeSelectProps={{
                value: form.type_gibier,
                onChange: (e) => setForm({ ...form, type_gibier: e.currentTarget.value as CarcasseType }),
              }}
            >
              {Object.values(CarcasseType).map((typeGibier) => (
                <option
                  key={typeGibier}
                  value={typeGibier}
                >
                  {TYPE_GIBIER_LABELS[typeGibier]}
                </option>
              ))}
            </Select>
            <Select
              label="Indicateur"
              nativeSelectProps={{
                value: form.indicateur,
                onChange: (e) =>
                  setForm({ ...form, indicateur: e.currentTarget.value as StatsRefIndicateur }),
              }}
            >
              {Object.values(StatsRefIndicateur).map((indicateur) => (
                <option
                  key={indicateur}
                  value={indicateur}
                >
                  {INDICATEUR_LABELS[indicateur]}
                </option>
              ))}
            </Select>
            <Input
              label="Valeur"
              hintText={isPourcentage ? 'En %' : 'En nombre de carcasses'}
              nativeInputProps={{
                type: 'number',
                step: 'any',
                min: 0,
                max: isPourcentage ? 100 : undefined,
                value: form.valeur,
                required: true,
                onChange: (e) => setForm({ ...form, valeur: e.currentTarget.value }),
              }}
            />
            <Input
              label="Source"
              hintText="Facultatif"
              nativeInputProps={{
                value: form.source,
                onChange: (e) => setForm({ ...form, source: e.currentTarget.value }),
              }}
            />
          </div>
          {error && (
            <Alert
              severity="error"
              small
              description={error}
              className="mb-4"
            />
          )}
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button
                type="button"
                priority="secondary"
                onClick={resetForm}
              >
                Annuler
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSaving}
            >
              {editingId ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </section>
      <section className="mb-4 bg-white p-4 md:p-8 md:shadow-sm">
        <Table
          noCaption
          className="[&_td]:align-middle"
          headers={[
            'Saison',
            'Circuit',
            'Gibier',
            'Indicateur',
            'Valeur',
            'Source',
            'Mis à jour le',
            'Actions',
          ]}
          data={statsRefs.map((statsRef) => [
            statsRef.saison,
            CIRCUIT_LABELS[statsRef.circuit],
            TYPE_GIBIER_LABELS[statsRef.type_gibier],
            INDICATEUR_LABELS[statsRef.indicateur],
            statsRef.valeur,
            statsRef.source ?? '',
            dayjs(statsRef.updated_at).format('DD/MM/YYYY à HH:mm'),
            <div
              key={statsRef.id}
              className="flex gap-2"
            >
              <Button
                size="small"
                priority="secondary"
                onClick={() => editStatsRef(statsRef)}
              >
                Modifier
              </Button>
              <Button
                size="small"
                priority="tertiary"
                onClick={() => deleteStatsRef(statsRef)}
              >
                Supprimer
              </Button>
            </div>,
          ])}
        />
      </section>
    </div>
  );
}
