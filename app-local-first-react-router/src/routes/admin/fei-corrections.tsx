import { useState } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { CarcasseType } from '@prisma/client';
import dayjs from 'dayjs';
import API from '@app/services/api';
import InputVille from '@app/components/InputVille';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import type { AdminFeiCorrectionResponse, AdminFeiDetailResponse } from '@api/src/types/responses';

type FeiDetail = AdminFeiDetailResponse['data']['fei'];
type Corrections = AdminFeiDetailResponse['data']['corrections'];

const AUTRE_CHASSEUR = 'autre-chasseur';

function useCorrection(path: string, onSaved: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  function save(body: Record<string, unknown>) {
    setError(null);
    setIsSaving(true);
    API.post({ path, body })
      .then((res) => res as AdminFeiCorrectionResponse)
      .then((res) => {
        if (!res.ok) return setError(res.error);
        onSaved();
      })
      .finally(() => setIsSaving(false));
  }
  return { error, isSaving, save };
}

function FormButtons({ isSaving, onCancel }: { isSaving: boolean; onCancel: () => void }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <Button
        type="button"
        priority="secondary"
        size="small"
        onClick={onCancel}
      >
        Annuler
      </Button>
      <Button
        type="submit"
        size="small"
        disabled={isSaving}
      >
        Enregistrer
      </Button>
    </div>
  );
}

function CorrectionError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Alert
      severity="error"
      small
      description={error}
      className="mb-2"
    />
  );
}

export function IdentiteCorrectionForm({
  fei,
  onCancel,
  onSaved,
}: {
  fei: FeiDetail;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const initialDate = fei.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('YYYY-MM-DD') : '';
  const [date, setDate] = useState(initialDate);
  const [commune, setCommune] = useState(fei.commune_mise_a_mort ?? '');
  const { error, isSaving, save } = useCorrection(
    `admin/fei/${encodeURIComponent(fei.numero)}/corrections`,
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({
          date_mise_a_mort: date !== initialDate ? date : undefined,
          commune_mise_a_mort: commune !== (fei.commune_mise_a_mort ?? '') ? commune : undefined,
        });
      }}
    >
      <CorrectionError error={error} />
      <Input
        label="Date de mise à mort"
        nativeInputProps={{ type: 'date', value: date, onChange: (e) => setDate(e.currentTarget.value) }}
      />
      <InputVille
        label="Commune de prélèvement du gibier"
        nativeInputProps={{ defaultValue: commune }}
        onSelect={setCommune}
      />
      <FormButtons
        isSaving={isSaving}
        onCancel={onCancel}
      />
    </form>
  );
}

export function PremierDetenteurCorrectionForm({
  fei,
  corrections,
  onCancel,
  onSaved,
}: {
  fei: FeiDetail;
  corrections: Corrections;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const examinateurEmail = fei.FeiExaminateurInitialUser?.email ?? '';
  const premierDetenteurEmail = fei.FeiPremierDetenteurUser?.email ?? '';
  const estUnAutreChasseur =
    !fei.premier_detenteur_entity_id && !!premierDetenteurEmail && premierDetenteurEmail !== examinateurEmail;
  const [choix, setChoix] = useState(
    fei.premier_detenteur_entity_id ?? (estUnAutreChasseur ? AUTRE_CHASSEUR : examinateurEmail)
  );
  const [email, setEmail] = useState(estUnAutreChasseur ? premierDetenteurEmail : '');
  const { error, isSaving, save } = useCorrection(
    `admin/fei/${encodeURIComponent(fei.numero)}/corrections`,
    onSaved
  );
  const isAssociation = corrections.associationsDeChasse.some((association) => association.id === choix);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({
          premier_detenteur: isAssociation
            ? { entity_id: choix }
            : { email: choix === AUTRE_CHASSEUR ? email : choix },
        });
      }}
    >
      <CorrectionError error={error} />
      <Select
        label="Premier détenteur"
        nativeSelectProps={{ value: choix, onChange: (e) => setChoix(e.currentTarget.value) }}
      >
        {examinateurEmail && <option value={examinateurEmail}>{examinateurEmail} (examinateur)</option>}
        {corrections.associationsDeChasse.map((association) => (
          <option
            key={association.id}
            value={association.id}
          >
            {association.nom_d_usage} (association)
          </option>
        ))}
        <option value={AUTRE_CHASSEUR}>Autre chasseur…</option>
      </Select>
      {choix === AUTRE_CHASSEUR && (
        <Input
          label="Email du chasseur"
          nativeInputProps={{ type: 'email', value: email, onChange: (e) => setEmail(e.currentTarget.value) }}
        />
      )}
      <FormButtons
        isSaving={isSaving}
        onCancel={onCancel}
      />
    </form>
  );
}

export function AddCarcasseForm({ fei, onSaved }: { fei: FeiDetail; onSaved: () => void }) {
  const [numeroBracelet, setNumeroBracelet] = useState('');
  const [espece, setEspece] = useState('');
  const [nombreDAnimaux, setNombreDAnimaux] = useState('1');
  const isPetitGibier = petitGibier.especes.includes(espece);
  const { error, isSaving, save } = useCorrection(
    `admin/fei/${encodeURIComponent(fei.numero)}/carcasse`,
    () => {
      setNumeroBracelet('');
      setEspece('');
      setNombreDAnimaux('1');
      onSaved();
    }
  );

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          numero_bracelet: numeroBracelet,
          espece,
          type: isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER,
          nombre_d_animaux: isPetitGibier ? Number(nombreDAnimaux) : undefined,
        });
      }}
    >
      <CorrectionError error={error} />
      <div className="flex flex-wrap items-end gap-2 [&_.fr-input-group]:mb-0 [&_.fr-select-group]:mb-0">
        <Input
          label="Marquage"
          nativeInputProps={{
            value: numeroBracelet,
            onChange: (e) => setNumeroBracelet(e.currentTarget.value),
          }}
        />
        <Select
          label="Espèce"
          nativeSelectProps={{ value: espece, onChange: (e) => setEspece(e.currentTarget.value) }}
        >
          <option value="">Sélectionnez l'espèce</option>
          <optgroup label="Grand gibier">
            {grandGibier.especes.map((e) => (
              <option
                key={e}
                value={e}
              >
                {e}
              </option>
            ))}
          </optgroup>
          <optgroup label="Petit gibier">
            {petitGibier.especes.map((e) => (
              <option
                key={e}
                value={e}
              >
                {e}
              </option>
            ))}
          </optgroup>
        </Select>
        {isPetitGibier && (
          <Input
            label="Nombre d'animaux"
            nativeInputProps={{
              type: 'number',
              min: 1,
              value: nombreDAnimaux,
              onChange: (e) => setNombreDAnimaux(e.currentTarget.value),
            }}
          />
        )}
        <Button
          type="submit"
          size="small"
          iconId="fr-icon-add-line"
          disabled={isSaving}
        >
          Ajouter
        </Button>
      </div>
    </form>
  );
}
