import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CarcasseType, Prisma, type User, type Carcasse, UserRoles, CarcasseStatus } from '@prisma/client';
import dayjs from 'dayjs';
import { Select } from '@codegouvfr/react-dsfr/Select';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';
import useUser from '@app/zustand/user';
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

  const state = useZustandStore((state) => state);
  const createCarcasse = state.createCarcasse;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
  const carcasses = state.carcasses;
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
        label="Sélectionnez l'espèce du gibier"
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
      {espece && isPetitGibier && (
        <Input
          label="Nombre de carcasses dans le lot"
          hintText="Optionel, seulement pour le petit gibier"
          nativeInputProps={{
            type: 'number',
            name: Prisma.CarcasseScalarFieldEnum.nombre_d_animaux,
            value: nombreDAnimaux,
            onChange: (e) => setNombreDAnimaux(e.target.value),
          }}
        />
      )}
      {espece && (
        <Input
          label="Numéro de marquage (bracelet, languette)"
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
          nativeInputProps={{
            type: 'text',
            required: true,
            name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
            value: numeroBracelet,
            // replce slash and space by underscore
            onChange: (e) => setNumeroBracelet(e.target.value.replace(/\/|\s/g, '_')),
          }}
        />
      )}
      {espece && (
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
              svi_assigned_to_fei_at: null,
              svi_carcasse_manquante: null,
              svi_carcasse_consigne: null,
              svi_carcasse_consigne_at: null,
              svi_carcasse_consigne_motif: [],
              svi_carcasse_traitement_assainissant: [],
              svi_carcasse_consigne_levee: null,
              svi_carcasse_consigne_levee_at: null,
              svi_carcasse_saisie: [],
              svi_carcasse_saisie_partielle: false,
              svi_carcasse_saisie_partielle_morceaux: [],
              svi_carcasse_saisie_partielle_nombre_animaux: null,
              svi_carcasse_saisie_totale: false,
              svi_carcasse_saisie_motif: [],
              svi_carcasse_saisie_at: null,
              svi_carcasse_signed_at: null,
              svi_carcasse_commentaire: null,
              svi_carcasse_status: CarcasseStatus.SANS_DECISION,
              svi_carcasse_status_set_at: null,
              svi_ipm1_presentee_inspection: null,
              svi_ipm1_date: null,
              svi_ipm1_user_id: null,
              svi_ipm1_user_name_cache: null,
              svi_ipm1_protocole: null,
              svi_ipm1_pieces: [],
              svi_ipm1_lesions_ou_motifs: [],
              svi_ipm1_nombre_animaux: null,
              svi_ipm1_commentaire: null,
              svi_ipm1_decision: null,
              svi_ipm1_duree_consigne: null,
              svi_ipm1_poids_consigne: null,
              svi_ipm1_signed_at: null,
              svi_ipm2_date: null,
              svi_ipm2_presentee_inspection: null,
              svi_ipm2_user_id: null,
              svi_ipm2_user_name_cache: null,
              svi_ipm2_protocole: null,
              svi_ipm2_pieces: [],
              svi_ipm2_lesions_ou_motifs: [],
              svi_ipm2_nombre_animaux: null,
              svi_ipm2_commentaire: null,
              svi_ipm2_decision: null,
              svi_ipm2_traitement_assainissant: [],
              svi_ipm2_traitement_assainissant_cuisson_temps: null,
              svi_ipm2_traitement_assainissant_cuisson_temp: null,
              svi_ipm2_traitement_assainissant_congelation_temps: null,
              svi_ipm2_traitement_assainissant_congelation_temp: null,
              svi_ipm2_traitement_assainissant_type: null,
              svi_ipm2_traitement_assainissant_paramètres: null,
              svi_ipm2_traitement_assainissant_etablissement: null,
              svi_ipm2_traitement_assainissant_poids: null,
              svi_ipm2_poids_saisie: null,
              svi_ipm2_signed_at: null,
              created_at: dayjs().toDate(),
              updated_at: dayjs().toDate(),
              deleted_at: null,
              is_synced: false,
            };
            createCarcasse(newCarcasse);
            addLog({
              user_id: user.id,
              user_role: UserRoles.EXAMINATEUR_INITIAL,
              fei_numero: fei.numero,
              action: 'examinateur-carcasse-create',
              history: createHistoryInput(null, newCarcasse),
              entity_id: fei.fei_current_owner_entity_id,
              zacharie_carcasse_id: newCarcasse.zacharie_carcasse_id,
              fei_intermediaire_id: null,
              carcasse_intermediaire_id: null,
            });
            setNumeroBracelet('');

            setError(null);
          }}
        >
          {isPetitGibier ? 'Enregistrer un lot de carcasses' : 'Enregistrer une carcasse'}
        </Button>
      )}
    </form>
  );
}
