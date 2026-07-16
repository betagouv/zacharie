import { useMemo, useState, useEffect } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, type User, UserRoles } from '@prisma/client';
import { Select } from '@codegouvfr/react-dsfr/Select';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import useUser from '@app/zustand/user';
import { createNewCarcasse } from '@app/utils/create-new-carcasse';
import AnomaliePicker from '@app/components/AnomaliePicker';
import { buildAnomaliePickerSections } from '@app/utils/update-carcasse-anomalies';
const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

const especesRaccourcis = ['Sanglier', 'Chevreuil', 'Cerf élaphe'];

function getNewDefaultNumeroBracelet(user: User) {
  if (!user.numero_cfei) {
    return '';
  }
  const prenom = user.prenom?.slice(0, 1).toUpperCase();
  const nom = user.nom_de_famille?.slice(0, 1).toUpperCase();
  // 4 derniers chiffres du numero cfei
  const numeroCfei = user.numero_cfei?.slice(-4);
  // denier marquage utilise + pad start 0 sur 3 chiffres
  const prochain_bracelet_a_utiliser = (user.prochain_bracelet_a_utiliser || 1).toString().padStart(3, '0');
  return `${prenom}${nom}${numeroCfei}-${prochain_bracelet_a_utiliser}`;
}

export default function NouvelleCarcasse({
  onCarcasseAdded,
  defaultEspece,
  footerRef,
  onFooterChange,
}: {
  onCarcasseAdded?: () => void;
  defaultEspece?: string;
  // Permet au parent d'exposer le CTA « Ajouter » dans le footer natif de la modale :
  // footerRef.current() déclenche la soumission ; onFooterChange remonte libellé + état désactivé.
  footerRef?: { current: (() => void) | null };
  onFooterChange?: (footer: { label: string; disabled: boolean }) => void;
}) {
  const params = useParams();
  const userState = useUser((state) => state);
  const user = userState.user!;
  const incProchainBraceletAUtiliser = userState.incProchainBraceletAUtiliser;

  const addLog = useZustandStore((state) => state.addLog);
  const fei = useZustandStore((state) => state.feis[params.fei_numero!]);
  const defaultNumeroBracelet = getNewDefaultNumeroBracelet(user);
  const [numeroBracelet, setNumeroBracelet] = useState<string>('');
  const [nombreDAnimaux, setNombreDAnimaux] = useState<string>('1');
  const [espece, setEspece] = useState<string>(defaultEspece ?? '');
  const [error, setError] = useState<string | null>(null);
  const [anomaliesCarcasse, setAnomaliesCarcasse] = useState<string[]>([]);
  const [anomaliesAbats, setAnomaliesAbats] = useState<string[]>([]);
  // Les anomalies sont une seconde étape : masquées à l'ouverture, accessibles via un bouton.
  const [showAnomalies, setShowAnomalies] = useState(false);

  const isPetitGibier = useMemo(() => {
    return petitGibier.especes.includes(espece);
  }, [espece]);

  const detailsCount = anomaliesCarcasse.length + (isPetitGibier ? 0 : anomaliesAbats.length);

  const detailsSections = useMemo(
    () =>
      buildAnomaliePickerSections({
        isPetitGibier,
        anomaliesCarcasse,
        anomaliesAbats,
        setAnomaliesCarcasse,
        setAnomaliesAbats,
      }),
    [isPetitGibier, anomaliesCarcasse, anomaliesAbats]
  );

  const zacharieCarcasseId = `${fei.numero}_${numeroBracelet}`;

  const submitDisabled = !espece || !numeroBracelet;
  const submitLabel = isPetitGibier ? 'Ajouter le lot de carcasses' : 'Ajouter la carcasse';

  const handleAddCarcasse = async () => {
    try {
      const newCarcasse = await createNewCarcasse({
        zacharieCarcasseId,
        numeroBracelet,
        espece,
        nombreDAnimaux,
        fei,
        examinateurAnomaliesCarcasse: anomaliesCarcasse,
        examinateurAnomaliesAbats: isPetitGibier ? [] : anomaliesAbats,
      });
      addLog({
        user_id: user.id,
        user_role: UserRoles.CHASSEUR,
        fei_numero: fei.numero,
        action: 'examinateur-carcasse-create',
        history: createHistoryInput(null, newCarcasse),
        entity_id: fei.fei_current_owner_entity_id,
        zacharie_carcasse_id: newCarcasse.zacharie_carcasse_id,
        intermediaire_id: null,
        carcasse_intermediaire_id: null,
      });
      syncData('examinateur-carcasse-create');
      setNumeroBracelet('');
      setAnomaliesCarcasse([]);
      setAnomaliesAbats([]);
      setShowAnomalies(false);
      setError(null);
      onCarcasseAdded?.();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Une erreur inconnue est survenue');
      }
    }
  };

  // Le CTA « Ajouter la carcasse » vit dans le footer natif de la modale (épinglé, hors scroll).
  // On expose l'action au parent via footerRef et on remonte libellé/état désactivé.
  if (footerRef) footerRef.current = handleAddCarcasse;
  useEffect(() => {
    onFooterChange?.({ label: submitLabel, disabled: submitDisabled });
  }, [submitLabel, submitDisabled, onFooterChange]);

  if (showAnomalies) {
    return (
      <AnomaliePicker
        sections={detailsSections}
        onBack={() => setShowAnomalies(false)}
      />
    );
  }

  return (
    <form
      method="POST"
      className="flex w-full flex-col items-stretch"
      onSubmit={(e) => e.preventDefault()}
    >
      <Select
        label="Espèce (grand et petit gibier) "
        className="group grow"
        hint={
          !espece && (
            <div className="flex flex-row flex-wrap items-center gap-2">
              {especesRaccourcis.map((_espece) => (
                <button
                  type="button"
                  key={_espece}
                  className="rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                  onClick={() => setEspece(_espece)}
                >
                  {_espece}
                </button>
              ))}
            </div>
          )
        }
        nativeSelectProps={{
          name: Prisma.CarcasseScalarFieldEnum.espece,
          value: espece,
          onChange: (e) => {
            const newEspece = e.currentTarget.value;
            setEspece(newEspece);
          },
        }}
      >
        <option value="">Sélectionnez l'espèce du gibier</option>
        {/* <hr /> */}
        {Object.entries(gibierSelect).map(([typeGibier, _especes]) => {
          return (
            <optgroup
              label={typeGibier}
              key={typeGibier}
            >
              {_especes.map((_espece: string) => {
                return (
                  <option
                    value={_espece}
                    key={_espece}
                  >
                    {_espece}
                  </option>
                );
              })}
            </optgroup>
          );
        })}
      </Select>
      {espece && isPetitGibier && (
        <Input
          label="Nombre de carcasses dans le lot"
          hintText="Seulement pour le petit gibier"
          nativeInputProps={{
            type: 'number',
            min: 0,
            name: Prisma.CarcasseScalarFieldEnum.nombre_d_animaux,
            value: nombreDAnimaux,
            onChange: (e) => setNombreDAnimaux(e.target.value),
          }}
        />
      )}
      <Input
        label="Numéro de marquage (bracelet, languette)"
        state={error ? 'error' : 'default'}
        stateRelatedMessage={error ?? ''}
        hintText={
          !numeroBracelet && (
            <>
              {defaultNumeroBracelet ? (
                <div
                  className={[
                    'flex flex-col items-start md:flex-row md:gap-2',
                    numeroBracelet ? 'pointer-events-none opacity-60' : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    className={[
                      'rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]',
                      // numeroBracelet ? 'pointer-events-none opacity-20' : '',
                    ].join(' ')}
                    onClick={() => {
                      incProchainBraceletAUtiliser();
                      setNumeroBracelet(defaultNumeroBracelet);
                    }}
                  >
                    {defaultNumeroBracelet}
                  </button>
                </div>
              ) : null}
            </>
          )
        }
        disabled={!espece}
        nativeInputProps={{
          type: 'text',
          required: true,
          disabled: !espece,
          placeholder: 'Numéro de marquage',
          name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
          value: numeroBracelet,
          // replce slash and space by underscore
          onChange: (e) => setNumeroBracelet(e.target.value.replace(/\/|\s/g, '_')),
        }}
      />
      <div className="my-2">
        <Button
          disabled={!espece}
          type="button"
          priority="secondary"
          iconId="fr-icon-list-unordered"
          onClick={() => setShowAnomalies(true)}
        >
          {detailsCount > 0 ? `Anomalies (${detailsCount})` : 'Ajouter une anomalie (facultatif)'}
        </Button>
      </div>
    </form>
  );
}
