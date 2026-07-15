import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { type Carcasse, CarcasseType, Prisma, UserRoles } from '@prisma/client';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { createHistoryInput } from '@app/utils/create-history-entry';
import AnomaliePicker from '@app/components/AnomaliePicker';
import { buildCarcasseNavSections } from '@app/utils/build-carcasse-nav-sections';

const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

// Formulaire d'examen initial d'une carcasse (espèce, numéro, nombre, anomalies).
// Toutes les modifications sont enregistrées en direct via le store (local-first).
// Utilisé dans la modale d'édition (depuis la liste) et dans la page détail.
export default function CarcasseExamenInitialForm({ carcasse }: { carcasse: Carcasse }) {
  const user = useUser((state) => state.user)!;
  const updateStateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);

  const updateCarcasse = (partialCarcasse: Partial<Carcasse>) => {
    updateStateCarcasse(carcasse.zacharie_carcasse_id, partialCarcasse);
    addLog({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: carcasse.fei_numero,
      action: 'examinateur-carcasse-edit',
      history: createHistoryInput(carcasse, partialCarcasse),
      entity_id: null,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
  };

  const feiCarcasses = useCarcassesForFei(carcasse.fei_numero);
  const existingsNumeroBracelet = useMemo(
    () =>
      feiCarcasses
        .filter((c) => c.zacharie_carcasse_id !== carcasse.zacharie_carcasse_id)
        .map((c) => c.numero_bracelet),
    [feiCarcasses, carcasse.zacharie_carcasse_id]
  );

  const [espece, setEspece] = useState(carcasse.espece || '');
  const [numero, setNumero] = useState(carcasse.numero_bracelet);
  const [numeroError, setNumeroError] = useState<string | null>(null);
  // Les anomalies sont une seconde étape : masquées à l'ouverture, accessibles via un bouton.
  const [showAnomalies, setShowAnomalies] = useState(false);

  const anomaliesCount =
    (carcasse.examinateur_anomalies_carcasse?.length ?? 0) +
    (carcasse.examinateur_anomalies_abats?.length ?? 0);

  const commitNumero = (value: string) => {
    if (!value || value === carcasse.numero_bracelet) {
      setNumeroError(null);
      return;
    }
    if (existingsNumeroBracelet.includes(value)) {
      setNumeroError('Le numéro de marquage est déjà utilisé pour cette fiche');
      return;
    }
    setNumeroError(null);
    updateCarcasse({ numero_bracelet: value, examinateur_signed_at: dayjs().toDate() });
  };

  if (showAnomalies) {
    return (
      <AnomaliePicker
        key={carcasse.zacharie_carcasse_id}
        sections={buildCarcasseNavSections(carcasse)}
        onBack={() => setShowAnomalies(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Espèce du gibier"
        className="group mb-0! grow"
        nativeSelectProps={{
          name: Prisma.CarcasseScalarFieldEnum.espece,
          value: espece,
          onChange: (e) => {
            const newEspece = e.currentTarget.value;
            setEspece(newEspece);
            updateCarcasse({
              espece: newEspece,
              type: petitGibier.especes.includes(newEspece)
                ? CarcasseType.PETIT_GIBIER
                : CarcasseType.GROS_GIBIER,
              examinateur_signed_at: dayjs().toDate(),
            });
          },
        }}
      >
        <option value="">Sélectionnez l'espèce du gibier</option>
        {Object.entries(gibierSelect).map(([typeGibier, _especes]) => (
          <optgroup
            label={typeGibier}
            key={typeGibier}
          >
            {_especes.map((_espece: string) => (
              <option
                value={_espece}
                key={_espece}
              >
                {_espece}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      <Input
        label={carcasse.type === CarcasseType.PETIT_GIBIER ? "Numéro d'identification" : 'Numéro de marquage'}
        className="mb-0!"
        state={numeroError ? 'error' : 'default'}
        stateRelatedMessage={numeroError ?? ''}
        nativeInputProps={{
          type: 'text',
          name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
          value: numero,
          onChange: (e) => setNumero(e.target.value),
          onBlur: (e) => commitNumero(e.target.value),
        }}
      />

      {carcasse.type === CarcasseType.PETIT_GIBIER && (
        <Input
          label="Nombre de carcasses"
          hintText="Optionnel"
          className="mb-0!"
          nativeInputProps={{
            type: 'number',
            min: 0,
            name: Prisma.CarcasseScalarFieldEnum.nombre_d_animaux,
            defaultValue: carcasse.nombre_d_animaux ?? '',
            onChange: (e) =>
              updateCarcasse({
                nombre_d_animaux: Number(e.currentTarget.value),
                examinateur_signed_at: dayjs().toDate(),
              }),
          }}
        />
      )}

      {espece && (
        <Button
          type="button"
          priority="secondary"
          iconId="fr-icon-list-unordered"
          onClick={() => setShowAnomalies(true)}
        >
          {anomaliesCount > 0 ? `Anomalies (${anomaliesCount})` : 'Ajouter une anomalie (facultatif)'}
        </Button>
      )}
    </div>
  );
}
