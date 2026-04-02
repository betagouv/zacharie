import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CarcasseType, EntityRelationType, FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import InputVille from '@app/components/InputVille';
import CarcassesExaminateur from './examinateur-carcasses';
import SelectNextForExaminateur from './examinateur-select-next';
import DestinataireSelectPremierDetenteur, {
  type DestinatairePremierDetenteurHandle,
} from './destinataire-select-premier-detenteur';
import DeleteFei from './delete-fei';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import useZustandStore, { syncData } from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { createHistoryInput } from '@app/utils/create-history-entry';
import Alert from '@codegouvfr/react-dsfr/Alert';
import useGetCommunesDeChasseFavorites from '@app/utils/useGetCommunesDeChasseFavorites';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import DateHeureValidationAlerts from './date-heure-validation-alerts';

export default function FEIExaminateurInitial() {
  const params = useParams();
  const navigate = useNavigate();
  const user = useUser((state) => state.user)!;

  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  const carcasses = useCarcassesForFei(params.fei_numero);

  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);

  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? users[fei.examinateur_initial_user_id!]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id ? users[fei.premier_detenteur_user_id!] : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id!]
    : null;
  const updateFeiState = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const updateFei: typeof updateFeiState = (fei_numero, nextFei) => {
    updateFeiState(fei_numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: fei_numero,
      action: 'examinateur-update-fei',
      history: createHistoryInput(fei, nextFei),
      entity_id: null,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData('examinateur-initial-update-fei');
  };

  const [approbation, setApprobation] = useState(
    fei.examinateur_initial_approbation_mise_sur_le_marche ? true : false,
  );
  const destinataireRef = useRef<DestinatairePremierDetenteurHandle | null>(null);

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  const [carcassesNotReady, atLeastOneCarcasseWithAnomalie] = useMemo(() => {
    const notReady = [];
    let _atLeastOneCarcasseWithAnomalie = false;
    for (const carcasse of carcasses.filter((c) => c !== null)) {
      if (!carcasse.examinateur_signed_at || !carcasse.espece) {
        notReady.push(carcasse);
      }
      if (carcasse.examinateur_anomalies_abats?.length || carcasse.examinateur_anomalies_carcasse?.length) {
        _atLeastOneCarcasseWithAnomalie = true;
      }
    }
    return [notReady, _atLeastOneCarcasseWithAnomalie];
  }, [carcasses]);

  const onlyPetitGibier = useMemo(() => {
    for (const carcasse of carcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) {
        return false;
      }
    }
    return true;
  }, [carcasses]);

  const canEdit = useMemo(() => {
    if (
      fei.fei_current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
      fei.fei_current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL
    ) {
      return false;
    }
    if (fei.automatic_closed_at || fei.svi_closed_at || fei.svi_assigned_at || fei.intermediaire_closed_at) {
      return false;
    }
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user]);

  const canEditAsPremierDetenteur = useMemo(() => {
    if (
      fei.fei_current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
      fei.fei_current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL
    ) {
      return false;
    }
    if (fei.svi_closed_at || fei.automatic_closed_at || fei.svi_assigned_at || fei.intermediaire_closed_at) {
      return false;
    }
    if (fei.examinateur_initial_user_id === user.id) {
      return true;
    }
    if (
      fei.fei_current_owner_user_id === user.id &&
      fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR
    ) {
      return true;
    }
    if (premierDetenteurEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      return true;
    }
    return false;
  }, [fei, user, premierDetenteurEntity]);

  const examinateurIsPremierDetenteur = fei.premier_detenteur_user_id === user.id;

  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const carcasseIds = useMemo(() => carcasses.map((c) => c.zacharie_carcasse_id), [carcasses]);

  const Component = canEdit ? Input : InputNotEditable;
  const VilleComponent = canEdit ? InputVille : InputNotEditable;

  const jobIsMissing = useMemo(() => {
    if (!fei.date_mise_a_mort) {
      return 'Il manque la date de mise à mort';
    }
    if (!fei.commune_mise_a_mort) {
      return 'Il manque la commune de mise à mort';
    }
    if (!fei.heure_mise_a_mort_premiere_carcasse) {
      return "Il manque l'heure de mise à mort de la première carcasse";
    }
    if (!onlyPetitGibier) {
      if (!fei.heure_evisceration_derniere_carcasse) {
        return "Il manque l'heure d'éviscération de la dernière carcasse";
      }
    }
    if (carcasses.length === 0) {
      return "Il n'y a pas de carcasses";
    }
    if (carcassesNotReady.length > 0) {
      return 'Il manque des informations sur certaines carcasses';
    }
    if (!fei.examinateur_initial_date_approbation_mise_sur_le_marche) {
      return 'Il manque la date de validation de l\u2019examen initial';
    }
    return null;
  }, [fei, carcassesNotReady, carcasses, onlyPetitGibier]);

  const checkboxLabel = useMemo(() => {
    let label = '';
    if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
      if (fei.examinateur_initial_user_id === user.id) {
        label = "J'ai certifié";
      } else {
        label = `${examinateurInitialUser?.nom_de_famille} ${examinateurInitialUser?.prenom} a certifié`;
      }
    } else {
      if (fei.examinateur_initial_user_id === user.id) {
        label = `Je, ${examinateurInitialUser?.nom_de_famille} ${examinateurInitialUser?.prenom}, certifie`;
      } else {
        return '';
      }
    }
    if (!atLeastOneCarcasseWithAnomalie) {
      label += " qu'aucune anomalie n'a été observée lors de l'examen initial";
      if (!fei.consommateur_final_usage_domestique) {
        label += ' et que les carcasses en peau examinées ce jour peuvent être mises sur le marché.';
      } else {
        label += '.';
      }
      return label;
    } else {
      label +=
        ' que les carcasses en peau examinées ce jour présentent au moins une anomalie. Toutefois, elles peuvent être mises sur le marché.';
    }
    return label;
  }, [
    fei.examinateur_initial_approbation_mise_sur_le_marche,
    examinateurInitialUser?.nom_de_famille,
    examinateurInitialUser?.prenom,
    atLeastOneCarcasseWithAnomalie,
    fei.consommateur_final_usage_domestique,
    user.id,
    fei.examinateur_initial_user_id,
  ]);

  const communesDeChasseFavorites = useGetCommunesDeChasseFavorites(!fei?.commune_mise_a_mort);

  // Progressive display conditions
  const hasPremierDetenteur = !!(premierDetenteurUser || premierDetenteurEntity);
  const showBloc2 = !canEdit || !!(fei.date_mise_a_mort && fei.commune_mise_a_mort && hasPremierDetenteur);
  const showBloc3 =
    !canEdit ||
    !!(
      showBloc2 &&
      carcasses.length >= 1 &&
      fei.heure_mise_a_mort_premiere_carcasse &&
      (onlyPetitGibier || fei.heure_evisceration_derniere_carcasse)
    );
  const showBloc4 = showBloc3;

  return (
    <div className="flex flex-col gap-6">
      {/* Bloc 1 — Informations de chasse */}
      <div className="bg-white p-4 md:p-8">
        <h4 className="fr-h5">Informations de chasse</h4>
        <Component
          label="Date de mise à mort (et d'éviscération)&nbsp;*"
          hintText={
            canEdit ? (
              <button
                className="inline-block"
                type="button"
                onClick={() => {
                  const date = dayjs.utc().startOf('day').toDate();
                  updateFei(fei.numero, {
                    date_mise_a_mort: date,
                  });
                }}
              >
                <u className="inline">Cliquez ici</u> pour définir la date du jour
              </button>
            ) : null
          }
          nativeInputProps={{
            id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
            name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
            type: 'date',
            autoComplete: 'off',
            required: true,
            suppressHydrationWarning: true,
            placeholder: 'Date de mise à mort *',
            onBlur: (e) => {
              if (!e.target.value) return;
              const date = dayjs.utc(e.target.value).startOf('day');
              if (date.isBefore(dayjs().add(-6, 'months'))) {
                alert(`Il est impossible de définir une date de mise à mort antérieure à 6 mois.`);
                return;
              }
              updateFei(fei.numero, {
                date_mise_a_mort: date.toDate(),
              });
            },
            defaultValue: fei?.date_mise_a_mort ? dayjs(fei?.date_mise_a_mort).format('YYYY-MM-DD') : '',
          }}
        />
        <DateHeureValidationAlerts
          fei={fei}
          showHeureMiseAMortAlert={false}
          showHeureEviscerationAlert={false}
        />
        <VilleComponent
          label="Commune de mise à mort&nbsp;*"
          key={fei?.commune_mise_a_mort}
          onSelect={(commune_mise_a_mort) => updateFei(fei.numero, { commune_mise_a_mort })}
          hintText={
            <>
              {communesDeChasseFavorites.map((commune) => {
                return (
                  <Tag
                    key={commune}
                    iconId="fr-icon-checkbox-circle-line"
                    className="mr-2"
                    nativeButtonProps={{
                      onClick: () => updateFei(fei.numero, { commune_mise_a_mort: commune }),
                    }}
                  >
                    {commune}
                  </Tag>
                );
              })}
            </>
          }
          nativeInputProps={{
            id: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
            name: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
            placeholder: 'Commune de mise à mort *',
            type: 'text',
            required: true,
            autoComplete: 'off',
            defaultValue: fei?.commune_mise_a_mort ?? '',
          }}
        />
        <SelectNextForExaminateur />
      </div>

      {/* Bloc 2 — Carcasses */}
      {showBloc2 && (
        <div className="bg-white p-4 md:p-8">
          <h4 className="fr-h5">Carcasses</h4>
          <CarcassesExaminateur canEdit={canEdit} canEditAsPremierDetenteur={canEditAsPremierDetenteur} />
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
          <Component
            className="mt-4"
            label="Heure de mise à mort de la première carcasse&nbsp;*"
            nativeInputProps={{
              id: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
              name: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
              type: 'time',
              required: true,
              onChange: (e) => {
                updateFei(fei.numero, { heure_mise_a_mort_premiere_carcasse: e.target.value });
              },
              onBlur: (e) => {
                const heure_mise_a_mort_premiere_carcasse = e.target.value;
                if (!fei.heure_evisceration_derniere_carcasse) {
                  updateFei(fei.numero, { heure_mise_a_mort_premiere_carcasse });
                } else if (fei.heure_evisceration_derniere_carcasse <= heure_mise_a_mort_premiere_carcasse) {
                  alert(
                    "L'heure de mise à mort de la première carcasse doit être inférieure à l'heure d'éviscération de la dernière carcasse",
                  );
                  e.target.value = '';
                  updateFei(fei.numero, { heure_mise_a_mort_premiere_carcasse: '' });
                } else {
                  updateFei(fei.numero, { heure_mise_a_mort_premiere_carcasse });
                }
              },
              autoComplete: 'off',
              defaultValue: fei?.heure_mise_a_mort_premiere_carcasse ?? '',
            }}
          />
          <DateHeureValidationAlerts fei={fei} showDateAlert={false} showHeureEviscerationAlert={false} />
          {!onlyPetitGibier && (
            <>
              <Component
                label="Heure d'éviscération de la dernière carcasse&nbsp;*"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                  name: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                  type: 'time',
                  required: true,
                  autoComplete: 'off',
                  onChange: (e) => {
                    updateFei(fei.numero, { heure_evisceration_derniere_carcasse: e.target.value });
                  },
                  onBlur: (e) => {
                    const heure_evisceration_derniere_carcasse = e.target.value;
                    if (!fei.heure_mise_a_mort_premiere_carcasse) {
                      updateFei(fei.numero, { heure_evisceration_derniere_carcasse });
                    } else if (
                      fei.heure_mise_a_mort_premiere_carcasse >= heure_evisceration_derniere_carcasse
                    ) {
                      alert(
                        "L'heure d'éviscération de la dernière carcasse doit être supérieure à l'heure de mise à mort de la première carcasse",
                      );
                      e.target.value = '';
                      updateFei(fei.numero, { heure_evisceration_derniere_carcasse: '' });
                    } else {
                      updateFei(fei.numero, { heure_evisceration_derniere_carcasse });
                    }
                  },
                  defaultValue: fei?.heure_evisceration_derniere_carcasse ?? '',
                }}
              />
              <DateHeureValidationAlerts fei={fei} showDateAlert={false} showHeureMiseAMortAlert={false} />
            </>
          )}
          {canEdit && !showBloc3 && (
            <Button className="mt-4" disabled>
              {carcasses.length === 0
                ? 'Ajoutez au moins une carcasse pour continuer'
                : !fei.heure_mise_a_mort_premiere_carcasse
                  ? "Remplissez l'heure de mise à mort pour continuer"
                  : !onlyPetitGibier && !fei.heure_evisceration_derniere_carcasse
                    ? "Remplissez l'heure d'éviscération pour continuer"
                    : 'Continuer'}
            </Button>
          )}
        </div>
      )}

      {/* Bloc 3 — Destinataire */}
      {showBloc3 && examinateurIsPremierDetenteur && (
        <div className="bg-white p-4 md:p-8">
          <h4 className="fr-h5">Destinataire</h4>
          <DestinataireSelectPremierDetenteur
            canEdit={canEditAsPremierDetenteur}
            submitRef={destinataireRef}
            hideSubmitButton={canEdit}
          />
        </div>
      )}

      {/* Bloc 4 — Validation de l'examen initial */}
      {showBloc4 && examinateurInitialUser && (
        <div className="bg-white p-4 md:p-8">
          <h4 className="fr-h5">Validation de l'examen initial</h4>
          <Component
            label="Date de validation de l'examen initial et de mise sur le marché *"
            hintText={
              canEdit ? (
                <button
                  className="inline-block text-left"
                  type="button"
                  onClick={() => {
                    updateFei(fei.numero, {
                      examinateur_initial_date_approbation_mise_sur_le_marche: dayjs().toDate(),
                      resume_nombre_de_carcasses: countCarcassesByEspece.join('\n'),
                    });
                  }}
                >
                  <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant
                </button>
              ) : (
                "Cette date vaut date d'approbation de mise sur le marché"
              )
            }
            nativeInputProps={{
              id: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
              name: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
              type: 'datetime-local',
              autoComplete: 'off',
              suppressHydrationWarning: true,
              onBlur: (e) => {
                updateFei(fei.numero, {
                  examinateur_initial_date_approbation_mise_sur_le_marche: dayjs(e.target.value).toDate(),
                  resume_nombre_de_carcasses: countCarcassesByEspece.join('\n'),
                });
              },
              defaultValue: fei?.examinateur_initial_date_approbation_mise_sur_le_marche
                ? dayjs(fei?.examinateur_initial_date_approbation_mise_sur_le_marche).format(
                  'YYYY-MM-DDTHH:mm',
                )
                : undefined,
            }}
          />
          <Checkbox
            className={canEdit ? '' : 'checkbox-black'}
            options={[
              {
                label: checkboxLabel,
                nativeInputProps: {
                  required: true,
                  name: Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche,
                  value: 'true',
                  disabled: !canEdit,
                  onChange: () => setApprobation(!approbation),
                  readOnly: !!fei.examinateur_initial_approbation_mise_sur_le_marche,
                  checked: approbation,
                },
              },
            ]}
          />
          {!!jobIsMissing?.length && (
            <Alert title="Attention" className="mt-4" severity="error" description={jobIsMissing} />
          )}
          {canEdit && (
            <div className="mt-6 flex flex-col gap-4">
              <Button
                type="submit"
                disabled={!carcasses.length}
                onClick={(e) => {
                  e.preventDefault();
                  if (jobIsMissing) {
                    alert(jobIsMissing);
                    return;
                  }
                  if (!approbation) {
                    alert('Vous devez cocher la case pour valider la mise sur le marché');
                    return;
                  }
                  if (examinateurIsPremierDetenteur) {
                    const destinataireError = destinataireRef.current?.validate();
                    if (destinataireError) {
                      alert(destinataireError);
                      return;
                    }
                    updateFei(fei.numero, {
                      examinateur_initial_approbation_mise_sur_le_marche: approbation,
                      fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
                      fei_current_owner_user_id: user.id,
                      fei_current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
                      fei_current_owner_entity_id: fei.premier_detenteur_entity_id,
                      fei_current_owner_entity_name_cache: premierDetenteurEntity?.nom_d_usage ?? null,
                    });
                    destinataireRef.current?.submit();
                  } else {
                    updateFei(fei.numero, {
                      examinateur_initial_approbation_mise_sur_le_marche: approbation,
                      fei_current_owner_user_id: fei.premier_detenteur_user_id,
                      fei_current_owner_user_name_cache:
                        premierDetenteurUser?.prenom + ' ' + premierDetenteurUser?.nom_de_famille,
                      fei_current_owner_entity_id: fei.premier_detenteur_entity_id,
                      fei_current_owner_entity_name_cache: premierDetenteurEntity?.nom_d_usage ?? null,
                      fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
                    });
                    updateCarcassesTransmission(carcasseIds, {
                      current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
                      current_owner_user_id: fei.premier_detenteur_user_id,
                      current_owner_user_name_cache:
                        premierDetenteurUser?.prenom + ' ' + premierDetenteurUser?.nom_de_famille,
                      current_owner_entity_id: fei.premier_detenteur_entity_id ?? null,
                      current_owner_entity_name_cache: premierDetenteurEntity?.nom_d_usage ?? null,
                    });
                    syncData('examinateur-initial-transfer-to-premier-detenteur');
                    navigate(`/app/tableau-de-bord/fei/${fei.numero}/envoyée`, {
                      state: { transferredToPremierDetenteur: true },
                    });
                  }
                }}
              >
                Enregistrer et transmettre la fiche
              </Button>
              <Button
                priority="secondary"
                type="button"
                onClick={() => {
                  syncData('brouillon');
                }}
              >
                Enregistrer comme brouillon
              </Button>
            </div>
          )}
        </div>
      )}
      {canEdit && <DeleteFei />}
    </div>
  );
}
