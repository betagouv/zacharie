import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
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
import { buildAnomaliePickerSections } from '@app/utils/build-carcasse-nav-sections';
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
}: {
  onCarcasseAdded?: () => void;
  defaultEspece?: string;
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

  const isPetitGibier = useMemo(() => {
    return petitGibier.especes.includes(espece);
  }, [espece]);

  const detailsModal = useRef(
    createModal({ id: 'nouvelle-carcasse-details', isOpenedByDefault: false })
  ).current;
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

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      const submitButton = document.getElementById('add-carcasse-submit-button');
      if (!submitButton) {
        return;
      }
      const navHeight = document.getElementById('bottom-navigation')?.getBoundingClientRect().height ?? 0;
      const buttonHeight = submitButton.getBoundingClientRect().height;
      const targetTop = window.innerHeight - navHeight - buttonHeight;
      const delta = submitButton.getBoundingClientRect().top - targetTop;
      const marginWithBottomBar = 10;
      window.scrollBy({
        top: delta + marginWithBottomBar,
        behavior: import.meta.env.VITE_TEST_PLAYWRIGHT !== 'true' ? 'smooth' : 'instant',
      });
    });
  }, []);

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
      {espece && (
        <div className="my-2">
          <Button
            type="button"
            priority="secondary"
            iconId="fr-icon-list-unordered"
            onClick={() => detailsModal.open()}
          >
            {detailsCount > 0 ? `Anomalie (${detailsCount})` : 'Ajouter une anomalie (facultatif)'}
          </Button>
          <detailsModal.Component
            title="Ajouter une anomalie"
            size="large"
            buttons={[{ doClosesModal: true, children: 'Terminer' }]}
          >
            <AnomaliePicker sections={detailsSections} />
          </detailsModal.Component>
        </div>
      )}
      <Button
        type="submit"
        id="add-carcasse-submit-button"
        disabled={!espece || !numeroBracelet}
        onClick={async (e) => {
          try {
            e.preventDefault();
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
              entity_id: null,
              zacharie_carcasse_id: newCarcasse.zacharie_carcasse_id,
              intermediaire_id: null,
              carcasse_intermediaire_id: null,
            });
            syncData('examinateur-carcasse-create');
            setNumeroBracelet('');
            setAnomaliesCarcasse([]);
            setAnomaliesAbats([]);
            setError(null);
            onCarcasseAdded?.();
          } catch (error) {
            if (error instanceof Error) {
              setError(error.message);
            } else {
              setError('Une erreur inconnue est survenue');
            }
          }
        }}
      >
        {isPetitGibier ? 'Ajouter le lot de carcasses' : 'Ajouter la carcasse'}
      </Button>
    </form>
  );
}
