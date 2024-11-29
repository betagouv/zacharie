import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CarcasseType, Prisma, type Fei, type Carcasse } from '@prisma/client';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import dayjs from 'dayjs';
import { Select } from '@codegouvfr/react-dsfr/Select';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

function getNewDefaultNumeroBracelet(fei: Fei) {
  if (!fei.commune_mise_a_mort) {
    return '';
  }
  return `ZACH-${fei.commune_mise_a_mort?.split(' ')[0].slice(0, -3).padStart(2, '0')}-${
    fei.examinateur_initial_user_id
  }-${dayjs().format('DDMMYY-HHmmss')}`;
}

export default function NouvelleCarcasse() {
  const params = useParams();

  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const carcasses = state.carcasses;
  const isOnline = useIsOnline();
  const [defaultNumeroBracelet, setDefaultNumeroBracelet] = useState<string>(
    getNewDefaultNumeroBracelet(fei),
  );
  const [numeroBracelet, setNumeroBracelet] = useState<string>('');
  const [nombreDAnimaux, setNombreDAnimaux] = useState<string>('1');
  const [espece, setEspece] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isPetitGibier = useMemo(() => {
    return petitGibier.especes.includes(espece);
  }, [espece]);

  const zacharieCarcasseId = `${fei.numero}_${numeroBracelet}`;

  return (
    <>
      <form method="POST" className="flex w-full flex-col items-stretch">
        <div className="fr-fieldset__element">
          <Select
            label="Sélectionnez l'espèce du gibier"
            className="group !mb-0 grow"
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
        </div>
        {espece && isPetitGibier && (
          <div className="fr-fieldset__element">
            <Input
              label="Nombre de carcasses dans le lot"
              className="!mb-0 grow"
              hintText="Optionel, seulement pour le petit gibier"
              nativeInputProps={{
                type: 'number',
                name: Prisma.CarcasseScalarFieldEnum.nombre_d_animaux,
                value: nombreDAnimaux,
                onChange: (e) => setNombreDAnimaux(e.target.value),
              }}
            />
          </div>
        )}
        {espece && (
          <div className="fr-fieldset__element">
            <Input
              label="Numéro de marquage (bracelet, languette)"
              className="!mb-0 grow"
              state={error ? 'error' : 'default'}
              stateRelatedMessage={error ?? ''}
              hintText={
                <>
                  {defaultNumeroBracelet ? (
                    <button
                      type="button"
                      className={[
                        'inline text-left',
                        numeroBracelet ? 'pointer-events-none opacity-20' : '',
                      ].join(' ')}
                      onClick={() => setNumeroBracelet(defaultNumeroBracelet)}
                    >
                      Votre chasse n'a pas de dispositif de marquage ?{' '}
                      <u className="inline">Cliquez ici pour utiliser {defaultNumeroBracelet}</u>.
                    </button>
                  ) : (
                    <>Veuillez renseigner la commune de mise à mort avant d'enregistrer une carcasse</>
                  )}
                </>
              }
              nativeInputProps={{
                type: 'text',
                required: true,
                name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                value: numeroBracelet,
                // replce slash and space by underscore
                onChange: (e) => setNumeroBracelet(e.target.value.replace(/\/|\s/g, '_')),
              }}
            />
          </div>
        )}
        {espece && (
          <div className="fr-fieldset__element">
            <Button
              type="submit"
              disabled={!fei.commune_mise_a_mort || !numeroBracelet}
              onClick={(e) => {
                e.preventDefault();
                if (!fei.commune_mise_a_mort) {
                  setError("Veuillez renseigner la commune de mise à mort avant d'enregistrer une carcasse");
                  return;
                }
                if (!numeroBracelet) {
                  setError("Veuillez renseigner le numéro de marquage avant d'enregistrer une carcasse");
                  return;
                }
                if (!espece) {
                  setError("Veuillez renseigner l'espèce du gibier avant d'enregistrer une carcasse");
                  return;
                }
                if (carcasses[zacharieCarcasseId] && !carcasses[zacharieCarcasseId].deleted_at) {
                  setError('Le numéro de marquage est déjà utilisé pour cette fiche');
                  return;
                }
                const newCarcasse: Carcasse = {
                  zacharie_carcasse_id: zacharieCarcasseId,
                  numero_bracelet: numeroBracelet,
                  fei_numero: fei.numero,
                  type: isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER,
                  nombre_d_animaux: isPetitGibier ? Number(nombreDAnimaux) : null,
                  heure_mise_a_mort: null,
                  heure_evisceration: null,
                  espece: espece,
                  categorie: null,
                  examinateur_carcasse_sans_anomalie: null,
                  examinateur_anomalies_carcasse: [],
                  examinateur_anomalies_abats: [],
                  examinateur_commentaire: null,
                  examinateur_signed_at: dayjs().toDate(),
                  intermediaire_carcasse_refus_intermediaire_id: null,
                  intermediaire_carcasse_refus_motif: null,
                  intermediaire_carcasse_signed_at: null,
                  intermediaire_carcasse_commentaire: null,
                  intermediaire_carcasse_manquante: null,
                  svi_carcasse_saisie: [],
                  svi_carcasse_saisie_motif: [],
                  svi_carcasse_saisie_at: null,
                  svi_carcasse_signed_at: null,
                  svi_carcasse_commentaire: null,
                  created_at: dayjs().toDate(),
                  updated_at: dayjs().toDate(),
                  deleted_at: null,
                  is_synced: false,
                };
                useZustandStore.getState().createCarcasse(newCarcasse);
                setDefaultNumeroBracelet(getNewDefaultNumeroBracelet(fei));
                setNumeroBracelet('');
                setError(null);
              }}
            >
              {isPetitGibier ? 'Enregistrer un lot de carcasses' : 'Enregistrer une carcasse'}
            </Button>
          </div>
        )}
      </form>
    </>
  );
}
