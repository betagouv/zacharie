import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, type User, UserRoles } from '@prisma/client';
import { Select } from '@codegouvfr/react-dsfr/Select';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { useParams } from 'react-router';
import useZustandStore, { syncData } from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';
import useUser from '@app/zustand/user';
import { createNewCarcasse } from '@app/utils/create-new-carcasse';
const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

function getNewDefaultNumeroBracelet(user: User) {
  if (!user.numero_cfei) {
    return '';
  }
  const prenom = user.prenom?.slice(0, 1).toUpperCase();
  const nom = user.nom_de_famille?.slice(0, 1).toUpperCase();
  // 4 derniers chiffres du numero cfei
  const numeroCfei = user.numero_cfei?.slice(-4);
  // denier bracelet utilise + pad start 0 sur 3 chiffres
  const prochain_bracelet_a_utiliser = (user.prochain_bracelet_a_utiliser || 1).toString().padStart(3, '0');
  return `${prenom}${nom}${numeroCfei}-${prochain_bracelet_a_utiliser}`;
}

export default function NouvelleCarcasse() {
  const params = useParams();
  const userState = useUser((state) => state);
  const user = userState.user!;
  const incProchainBraceletAUtiliser = userState.incProchainBraceletAUtiliser;

  const addLog = useZustandStore((state) => state.addLog);
  const fei = useZustandStore((state) => state.feis[params.fei_numero!]);
  const defaultNumeroBracelet = getNewDefaultNumeroBracelet(user);
  const [numeroBracelet, setNumeroBracelet] = useState<string>('');
  const [nombreDAnimaux, setNombreDAnimaux] = useState<string>('1');
  const [espece, setEspece] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isPetitGibier = useMemo(() => {
    return petitGibier.especes.includes(espece);
  }, [espece]);

  const zacharieCarcasseId = `${fei.numero}_${numeroBracelet}`;

  return (
    <form method="POST" className="flex w-full flex-col items-stretch">
      <Select
        label="Espèce (grand et petit gibier) *"
        className="group grow"
        nativeSelectProps={{
          name: Prisma.CarcasseScalarFieldEnum.espece,
          value: espece,
          onChange: (e) => {
            const newEspece = e.currentTarget.value;
            setEspece(newEspece);
          },
        }}
      >
        <option value="">Sélectionnez l'espèce du gibier *</option>
        {/* <hr /> */}
        {Object.entries(gibierSelect).map(([typeGibier, _especes]) => {
          return (
            <optgroup label={typeGibier} key={typeGibier}>
              {_especes.map((_espece: string) => {
                return (
                  <option value={_espece} key={_espece}>
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
          label="Nombre de carcasses dans le lot *"
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
        label="Numéro de marquage (bracelet, languette) *"
        state={error ? 'error' : 'default'}
        stateRelatedMessage={error ?? ''}
        hintText={
          <>
            {defaultNumeroBracelet ? (
              <button
                type="button"
                className={['inline text-left', numeroBracelet ? 'pointer-events-none opacity-20' : ''].join(
                  ' ',
                )}
                onClick={() => {
                  incProchainBraceletAUtiliser();
                  setNumeroBracelet(defaultNumeroBracelet);
                }}
              >
                Votre chasse n'a pas de dispositif de marquage ?{' '}
                <u className="inline">Cliquez ici pour utiliser {defaultNumeroBracelet}</u>.
              </button>
            ) : (
              <>Veuillez renseigner la commune de mise à mort avant d'enregistrer une carcasse</>
            )}
          </>
        }
        disabled={!espece}
        nativeInputProps={{
          type: 'text',
          required: true,
          disabled: !espece,
          placeholder: 'Numéro de marquage *',
          name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
          value: numeroBracelet,
          // replce slash and space by underscore
          onChange: (e) => setNumeroBracelet(e.target.value.replace(/\/|\s/g, '_')),
        }}
      />
      <Button
        type="submit"
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

            setError(null);
          } catch (error) {
            if (error instanceof Error) {
              setError(error.message);
            } else {
              setError('Une erreur inconnue est survenue');
            }
          }
        }}
      >
        {isPetitGibier ? 'Ajouter un lot de carcasses' : 'Ajouter une carcasse'}
      </Button>
    </form>
  );
}
