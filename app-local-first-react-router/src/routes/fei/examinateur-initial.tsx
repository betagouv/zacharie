import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import UserNotEditable from '@app/components/UserNotEditable';
import { CarcasseType, Prisma, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import InputVille from '@app/components/InputVille';
import CarcassesExaminateur from './examinateur-carcasses';
import SelectNextForExaminateur from './examinateur-select-next';
import FeiPremierDetenteur from './premier-detenteur';
import EntityNotEditable from '@app/components/EntityNotEditable';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses-by-espece';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { createHistoryInput } from '@app/utils/create-history-entry';
import Alert from '@codegouvfr/react-dsfr/Alert';

export default function FEIExaminateurInitial() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  // console.log('fei', fei);
  const carcasses = (state.carcassesIdsByFei[params.fei_numero!] || []).map((cId) => state.carcasses[cId]);
  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? state.users[fei.examinateur_initial_user_id!]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id
    ? state.users[fei.premier_detenteur_user_id!]
    : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? state.entities[fei.premier_detenteur_entity_id!]
    : null;
  const updateFeiState = state.updateFei;
  const addLog = state.addLog;
  const updateFei: typeof updateFeiState = (fei_numero, nextFei) => {
    updateFeiState(fei_numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: UserRoles.EXAMINATEUR_INITIAL,
      fei_numero: fei_numero,
      action: 'examinateur-update-fei',
      history: createHistoryInput(fei, nextFei),
      entity_id: null,
      zacharie_carcasse_id: null,
      fei_intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
  };

  const [approbation, setApprobation] = useState(
    fei.examinateur_initial_approbation_mise_sur_le_marche ? true : false,
  );
  // const entities = useZustandStore((state) => state.entities);
  // const nextOwnerEntity = fei.fei_next_owner_entity_id ? entities[fei.fei_next_owner_entity_id] : null;

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  const needSelectNextUser = useMemo(() => {
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.EXAMINATEUR_INITIAL) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    return true;
  }, [fei, user]);

  const examinateurIsAlsoPremierDetenteur = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.premier_detenteur_user_id !== user.id) {
      return false;
    }
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user]);

  const [carcassesNotReady, atLeastOneCarcasseWithAnomalie] = useMemo(() => {
    const notReady = [];
    let _atLeastOneCarcasseWithAnomalie = false;
    for (const carcasse of carcasses.filter((c) => c !== null)) {
      if (
        !carcasse.examinateur_signed_at ||
        // !carcasse.heure_evisceration ||
        // !carcasse.heure_mise_a_mort ||
        // !carcasse.categorie ||
        !carcasse.espece
      ) {
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
    if (fei.examinateur_initial_user_id !== user.id) {
      // seul l'examinateur initial peut modifier
      return false;
    }
    if (user.roles.includes(UserRoles.ADMIN)) {
      // les admins peuvent modifier
      return true;
    }
    // if (!carcasses.length) {
    // il faut au moins une carcasse
    // return true;
    // }
    // if (!onlyPetitGibier && !fei.heure_evisceration_derniere_carcasse) {
    // il faut l'heure d'éviscération de la dernière carcasse le cas échéant
    // return true;
    // }
    // if (!fei.commune_mise_a_mort) {
    //   return true;
    // }
    // if (!fei.date_mise_a_mort) {
    //   return true;
    // }
    // if (!fei.heure_mise_a_mort_premiere_carcasse) {
    //   return true;
    // }
    // if (needSelectNextUser) {
    // on garde la possibilité de modifier tout jusqu'à ce que le prochain utilisateur de la fiche soit en sa possession
    // pour palier à un oubli potentiel de l'examinatuer initial mêms après avoir validé la mise sur le marché
    // return true;
    // }
    // if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
    //   return false;
    // }
    return true;
  }, [fei, user]);

  const Component = canEdit ? Input : InputNotEditable;
  const VilleComponent = canEdit ? InputVille : InputNotEditable;

  const examRef = useRef<HTMLFormElement>(null);

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
      return "Il manque la date d'approbation de mise sur le marché";
    }
    return null;
  }, [fei, carcassesNotReady, carcasses, onlyPetitGibier]);

  const checkboxLabel = useMemo(() => {
    let label = fei.examinateur_initial_approbation_mise_sur_le_marche ? "J'ai certifié" : 'Je certifie';
    if (!atLeastOneCarcasseWithAnomalie) {
      label += " qu'aucune anomalie n'a été observée lors de l'examen initial et";
      label += ' que les carcasses en peau examinées ce jour peuvent être mises sur le marché.';
      return label;
    } else {
      label +=
        ' que les carcasses en peau examinées ce jour présentent au moins une anomalie. Toutefois, elles peuvent être mises sur le marché.';
    }
    return label;
  }, [fei.examinateur_initial_approbation_mise_sur_le_marche, atLeastOneCarcasseWithAnomalie]);

  return (
    <>
      <Accordion titleAs="h3" label="Données de chasse" defaultExpanded>
        <form method="POST" onSubmit={(e) => e.preventDefault()} ref={examRef}>
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
          <div className="fr-fieldset__element">
            <Component
              label="Date de mise à mort (et d'éviscération) *"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                type: 'date',
                autoComplete: 'off',
                required: true,
                suppressHydrationWarning: true,
                onBlur: (e) => {
                  const date = dayjs.utc(e.target.value).startOf('day').toDate();
                  updateFei(fei.numero, {
                    date_mise_a_mort: date,
                  });
                },
                defaultValue: fei?.date_mise_a_mort ? dayjs(fei?.date_mise_a_mort).format('YYYY-MM-DD') : '',
              }}
            />
          </div>
          <div className="fr-fieldset__element">
            <VilleComponent
              label="Commune de mise à mort *"
              onSelect={(commune_mise_a_mort) => updateFei(fei.numero, { commune_mise_a_mort })}
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
                name: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
                type: 'text',
                required: true,
                autoComplete: 'off',
                defaultValue: fei?.commune_mise_a_mort ?? '',
              }}
            />
          </div>
          <div className="fr-fieldset__element">
            <Component
              label="Heure de mise à mort de la première carcasse *"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                name: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                type: 'time',
                required: true,
                onBlur: (e) => updateFei(fei.numero, { heure_mise_a_mort_premiere_carcasse: e.target.value }),
                autoComplete: 'off',
                defaultValue: fei?.heure_mise_a_mort_premiere_carcasse ?? '',
              }}
            />
          </div>
        </form>
      </Accordion>
      <Accordion titleAs="h3" label={`Carcasses/Lots de carcasses (${carcasses.length})`} defaultExpanded>
        <CarcassesExaminateur canEdit={canEdit} />
      </Accordion>
      <Accordion titleAs="h3" label="Identité de l'Examinateur 🔒" defaultExpanded={!canEdit}>
        <UserNotEditable user={examinateurInitialUser!} withCfei />
      </Accordion>
      {examinateurInitialUser && (
        <Accordion titleAs="h3" label="Approbation de mise sur le marché" defaultExpanded>
          <form method="POST" onSubmit={(e) => e.preventDefault()}>
            <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
            {!onlyPetitGibier && (
              <div className="fr-fieldset__element">
                <Component
                  label="Heure d'éviscération de la dernière carcasse"
                  nativeInputProps={{
                    id: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                    name: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                    type: 'time',
                    required: true,
                    autoComplete: 'off',
                    onBlur: (e) =>
                      updateFei(fei.numero, { heure_evisceration_derniere_carcasse: e.target.value }),
                    defaultValue: fei?.heure_evisceration_derniere_carcasse ?? '',
                  }}
                />
              </div>
            )}

            <div className="fr-fieldset__element">
              <Component
                label="Date de validation de l’examen initial"
                hintText="Cette date vaut date d'approbation de mise sur le marché"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
                  name: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
                  type: 'datetime-local',
                  autoComplete: 'off',
                  suppressHydrationWarning: true,
                  onBlur: (e) =>
                    updateFei(fei.numero, {
                      examinateur_initial_date_approbation_mise_sur_le_marche: dayjs(e.target.value).toDate(),
                      resume_nombre_de_carcasses: countCarcassesByEspece.join('\n'),
                    }),
                  defaultValue: fei?.examinateur_initial_date_approbation_mise_sur_le_marche
                    ? dayjs(fei?.examinateur_initial_date_approbation_mise_sur_le_marche).format(
                        'YYYY-MM-DDTHH:mm',
                      )
                    : undefined,
                }}
              />
            </div>
            <div
              className={[
                'fr-fieldset__element',
                fei.examinateur_initial_approbation_mise_sur_le_marche ? 'pointer-events-none' : '',
              ].join(' ')}
            >
              <Checkbox
                options={[
                  {
                    label: checkboxLabel,
                    hintText: jobIsMissing,
                    nativeInputProps: {
                      required: true,
                      name: Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche,
                      value: 'true',
                      // disabled: !jobIsDone,
                      onChange: () => setApprobation(!approbation),
                      readOnly: !!fei.examinateur_initial_approbation_mise_sur_le_marche,
                      checked: approbation,
                    },
                  },
                ]}
              />
            </div>
            <div className="fr-fieldset__element">
              {canEdit && !needSelectNextUser && (
                <Button
                  type="submit"
                  disabled={!carcasses.length}
                  onClick={(e) => {
                    e.preventDefault();
                    if (jobIsMissing) {
                      e.preventDefault();
                      alert(jobIsMissing);
                    } else if (!approbation) {
                      alert('Vous devez cocher la case pour valider la mise sur le marché');
                    } else {
                      updateFei(fei.numero, {
                        examinateur_initial_approbation_mise_sur_le_marche: approbation,
                        // examinateur_initial_date_approbation_mise_sur_le_marche: approbation
                        //   ? dayjs().toDate()
                        //   : null,
                      });
                    }
                  }}
                >
                  Enregistrer
                </Button>
              )}
            </div>
            {!!jobIsMissing?.length && (
              <div className="fr-fieldset__element">
                <Alert title="Attention" severity="error" description={jobIsMissing} />
              </div>
            )}
          </form>
        </Accordion>
      )}
      {needSelectNextUser && (
        <div className="z-50 mt-4 flex flex-col bg-white pt-4 md:w-auto md:items-start [&_ul]:md:min-w-96">
          <SelectNextForExaminateur />
        </div>
      )}
      {examinateurIsAlsoPremierDetenteur && (
        <>
          <Accordion titleAs="h3" label="Identité du Premier détenteur 🔒" defaultExpanded={false}>
            {premierDetenteurEntity ? (
              <EntityNotEditable hideType entity={premierDetenteurEntity} user={premierDetenteurUser!} />
            ) : (
              <UserNotEditable user={premierDetenteurUser!} />
            )}
          </Accordion>
          <Accordion titleAs="h3" label="Action du Premier détenteur" defaultExpanded>
            <FeiPremierDetenteur showIdentity={false} />
          </Accordion>
        </>
      )}
    </>
  );
}
