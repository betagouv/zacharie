import { Fragment, useMemo, useState } from 'react';
import { Prisma, CarcasseIntermediaire, Carcasse, CarcasseType, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import dayjs from 'dayjs';
import SelectNextOwnerForPremierDetenteurOrIntermediaire from './premier-detenteur-intermediaire-select-next';
import CarcasseIntermediaireComp from './intermediaire-carcasse';
import EntityNotEditable from '@app/components/EntityNotEditable';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { sortCarcassesApproved } from '@app/utils/sort';
import CollecteurCarcassePreview from './collecteur-carcasse-preview';
import PencilStrikeThrough from '@app/components/PencilStrikeThrough';

export default function FEICurrentIntermediaire() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFeiIntermediaire = state.updateFeiIntermediaire;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
  const originalCarcasses = (state.carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => state.carcasses[cId])
    .filter((c) => !c.deleted_at);
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

  const [intermediaireIndex, setIntermediaireIndex] = useState(0);
  const intermediaire = intermediaires[intermediaireIndex];

  const intermediaireCarcasses = useMemo(() => {
    return [...new Set(state.carcassesIntermediairesByIntermediaire[intermediaire?.id] || [])]
      .map(
        (fei_numero__bracelet__intermediaire_id) =>
          state.carcassesIntermediaires[fei_numero__bracelet__intermediaire_id],
      )
      .sort((carcasseIntermediaireA, carcasseIntermediaireB) => {
        // sort by espece then by numero_bracelet
        const carcasseA = state.carcasses[carcasseIntermediaireA.zacharie_carcasse_id]!;
        const carcasseB = state.carcasses[carcasseIntermediaireB.zacharie_carcasse_id]!;
        if (carcasseA.espece === carcasseB.espece) {
          return carcasseA.numero_bracelet.localeCompare(carcasseB.numero_bracelet);
        }
        if (carcasseA.type === carcasseB.type) {
          return carcasseA.espece!.localeCompare(carcasseB.espece!);
        }
        return carcasseA.type!.localeCompare(carcasseB.type!);
      })
      .filter((c) => c != null);
  }, [
    intermediaire,
    state.carcassesIntermediairesByIntermediaire,
    state.carcassesIntermediaires,
    state.carcasses,
  ]);

  const isEtgWorkingFor = useMemo(() => {
    if (fei.fei_current_owner_role === UserRoles.ETG && !!fei.fei_current_owner_entity_id) {
      if (user.roles.includes(UserRoles.ETG)) {
        if (state.etgsIds.includes(fei.fei_current_owner_entity_id)) {
          const etg = state.entities[fei.fei_current_owner_entity_id];
          if (etg.relation === 'WORKING_FOR') {
            return true;
          }
        }
      }
    }
    return false;
  }, [fei, user, state]);

  const canEdit = useMemo(() => {
    if (isEtgWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!intermediaire) {
      return false;
    }
    if (intermediaire.fei_intermediaire_user_id !== user.id) {
      return false;
    }
    // if (intermediaire.check_finished_at) {
    //   return false;
    // }
    return true;
  }, [fei, user, intermediaire, isEtgWorkingFor]);

  const PriseEnChargeInput = canEdit ? Input : InputNotEditable;

  const carcassesSorted = useMemo(() => {
    const intermediaireCheckById: Record<
      CarcasseIntermediaire['fei_numero__bracelet__intermediaire_id'],
      CarcasseIntermediaire
    > = {};
    for (const intermediaireCheck of intermediaireCarcasses) {
      intermediaireCheckById[intermediaireCheck.fei_numero__bracelet__intermediaire_id] = intermediaireCheck;
    }
    const carcassesApproved: Record<string, Carcasse> = {};
    const carcassesRejetees: Record<string, Carcasse> = {};
    const carcassesManquantes: Record<string, Carcasse> = {};
    // const carcassesToCheck: Record<string, Carcasse> = {};
    for (const intermediaireCarcasse of intermediaireCarcasses) {
      const checkId = getCarcasseIntermediaireId(
        fei.numero,
        intermediaireCarcasse.numero_bracelet,
        intermediaire.id,
      );
      const carcasse = state.carcasses[intermediaireCarcasse.zacharie_carcasse_id];
      if (intermediaireCheckById[checkId]) {
        // console.log("intermediaireCheckById[checkId]", intermediaireCheckById[checkId]);
        if (intermediaireCheckById[checkId].prise_en_charge) {
          carcassesApproved[checkId] = carcasse;
        } else if (intermediaireCheckById[checkId].manquante) {
          // console.log("MANQUANTE ICI", intermediaireCheckById[checkId]);
          carcassesManquantes[checkId] = carcasse;
        } else {
          carcassesRejetees[checkId] = carcasse;
        }
      } else {
        if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
          if (carcasse.intermediaire_carcasse_refus_intermediaire_id === intermediaire.id) {
            if (carcasse.intermediaire_carcasse_manquante) {
              carcassesManquantes[checkId] = carcasse;
            } else {
              carcassesRejetees[checkId] = carcasse;
            }
          }
        } else {
          // carcassesToCheck[checkId] = carcasse;
        }
      }
    }
    return {
      carcassesApproved: Object.values(carcassesApproved),
      carcassesRejetees: Object.values(carcassesRejetees),
      carcassesManquantes: Object.values(carcassesManquantes),
      // carcassesToCheck: Object.values(carcassesToCheck),
    };
  }, [intermediaireCarcasses, intermediaire, fei, state.carcasses]);

  const carcassesApprovedSorted = useMemo(() => {
    return carcassesSorted.carcassesApproved.sort(sortCarcassesApproved);
  }, [carcassesSorted.carcassesApproved]);

  const labelCheckDone = useMemo(() => {
    let label = '';
    const nbCarcassesValidated = carcassesSorted.carcassesApproved.length;
    if (nbCarcassesValidated > 0) {
      label += `${
        intermediaire?.check_finished_at ? "J'ai pris" : 'Je prends'
      } en charge les carcasses que j'ai acceptées.`;
      if (nbCarcassesValidated === 1) {
        label += ' 1 carcasse/lot validé.';
      } else {
        label += ` ${nbCarcassesValidated} carcasses/lots validés.`;
      }
    }
    const nbCarcassesRejetees = carcassesSorted.carcassesRejetees.length;
    if (nbCarcassesRejetees > 0) {
      if (nbCarcassesRejetees === 1) {
        label += ' 1 carcasse/lot rejeté.';
      } else {
        label += ` ${nbCarcassesRejetees} carcasses/lots rejetés.`;
      }
    }
    const nbCarcassesManquantes = carcassesSorted.carcassesManquantes.length;
    if (nbCarcassesManquantes > 0) {
      if (nbCarcassesManquantes === 1) {
        label += ' 1 carcasse/lot manquant.';
      } else {
        label += ` ${nbCarcassesManquantes} carcasses/lots manquants.`;
      }
    }
    return label;
  }, [
    carcassesSorted.carcassesApproved.length,
    carcassesSorted.carcassesRejetees.length,
    carcassesSorted.carcassesManquantes.length,
    intermediaire?.check_finished_at,
  ]);

  const needSelectNextUser = useMemo(() => {
    if (!intermediaire?.check_finished_at) {
      return false;
    }
    if (isEtgWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    const latestIntermediaire = intermediaires[0];
    if (latestIntermediaire.id !== intermediaire?.id) {
      return false;
    }
    return true;
  }, [fei, user, intermediaire, intermediaires, isEtgWorkingFor]);

  // const prevCarcassesToCheckCount = useRef(carcassesSorted.carcassesToCheck.length);
  const [carcassesAValiderExpanded, setCarcassesAValiderExpanded] = useState(true);
  // const [carcassesAccepteesExpanded, setCarcassesAccepteesExpanded] = useState(false);
  // const [carcassesRefuseesExpanded, setCarcassesRefuseesExpanded] = useState(false);
  // const [carcassesManquantesExpanded, setCarcassesManquantesExpanded] = useState(false);

  // useEffect(() => {
  //   if (prevCarcassesToCheckCount.current > 0 && carcassesSorted.carcassesToCheck.length === 0) {
  //     setCarcassesAValiderExpanded(false);
  //     setCarcassesAccepteesExpanded(false);
  //     setCarcassesRefuseesExpanded(false);
  //   }
  //   prevCarcassesToCheckCount.current = carcassesSorted.carcassesToCheck.length;
  // }, [carcassesSorted.carcassesToCheck.length]);

  const onlyPetitGibier = useMemo(() => {
    for (const carcasse of originalCarcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) {
        return false;
      }
    }
    return true;
  }, [originalCarcasses]);

  function handleCheckFinishedAt(e: React.FormEvent<HTMLFormElement>) {
    if (!intermediaire) {
      return;
    }
    e.preventDefault();
    const checkFinishedAt = e.currentTarget[Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at].value;
    const nextFeiIntermediaire = {
      check_finished_at: dayjs(checkFinishedAt).toDate(),
    };
    updateFeiIntermediaire(intermediaire?.id, nextFeiIntermediaire);
    addLog({
      user_id: user.id,
      action: 'intermediaire-check-finished-at',
      fei_numero: fei.numero,
      fei_intermediaire_id: intermediaire?.id,
      history: createHistoryInput(intermediaire, nextFeiIntermediaire),
      user_role: intermediaire.fei_intermediaire_role!,
      entity_id: intermediaire.fei_intermediaire_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
    });
  }

  if (intermediaire) {
    return (
      <>
        {fei.fei_current_owner_role !== UserRoles.COLLECTEUR_PRO && (
          <nav
            id="fr-breadcrumb-:r54:"
            role="navigation"
            className="fr-breadcrumb"
            aria-label="vous êtes ici :"
            data-fr-js-breadcrumb="true"
          >
            <button
              className="fr-breadcrumb__button"
              aria-expanded="false"
              aria-controls="breadcrumb-:r55:"
              data-fr-js-collapse-button="true"
            >
              Voir les destinataires
            </button>
            <div className="fr-collapse" id="breadcrumb-:r55:" data-fr-js-collapse="true">
              <ol className="fr-breadcrumb__list">
                <li>
                  <span className="fr-breadcrumb__link !bg-none !no-underline">Premier Détenteur</span>
                </li>
                {intermediaires
                  .map((_intermediaire, index) => {
                    return (
                      <li key={_intermediaire.id}>
                        <button
                          onClick={() => setIntermediaireIndex(index)}
                          className="fr-breadcrumb__link"
                          aria-current={_intermediaire.id === intermediaire?.id ? 'step' : false}
                        >
                          {state.entities[_intermediaire.fei_intermediaire_entity_id!]?.nom_d_usage}
                        </button>
                      </li>
                    );
                  })
                  .reverse()}
              </ol>
            </div>
          </nav>
        )}

        <Accordion
          titleAs="h3"
          label={<>Identité de l'intermédaire {canEdit ? <PencilStrikeThrough /> : ''}</>}
        >
          <EntityNotEditable
            user={state.users[intermediaire.fei_intermediaire_user_id!]!}
            entity={state.entities[intermediaire.fei_intermediaire_entity_id!]!}
          />
        </Accordion>
        {canEdit ? (
          <Accordion
            titleAs="h3"
            label={`Carcasses (${intermediaireCarcasses.length})`}
            expanded={carcassesAValiderExpanded}
            onExpandedChange={setCarcassesAValiderExpanded}
          >
            {fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO && fei.premier_detenteur_name_cache && (
              <>
                <div className="fr-fieldset__element">
                  <InputNotEditable
                    label="Détenteur des carcasses"
                    nativeInputProps={{
                      id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                      name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                      autoComplete: 'off',
                      defaultValue: fei.premier_detenteur_name_cache || '',
                    }}
                  />
                </div>
                <div className="fr-fieldset__element">
                  <InputNotEditable
                    label="Date de la chasse"
                    nativeInputProps={{
                      id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                      name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                      type: 'text',
                      autoComplete: 'off',
                      suppressHydrationWarning: true,
                      defaultValue: fei?.date_mise_a_mort
                        ? dayjs(fei?.date_mise_a_mort).format('DD/MM/YYYY')
                        : '',
                    }}
                  />
                </div>
              </>
            )}
            {fei.fei_current_owner_role !== UserRoles.COLLECTEUR_PRO && (
              <>
                <div className="fr-fieldset__element">
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Date de mise à mort (et d'éviscération) *"
                      nativeInputProps={{
                        id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                        name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                        type: 'text',
                        autoComplete: 'off',
                        suppressHydrationWarning: true,
                        defaultValue: fei?.date_mise_a_mort
                          ? dayjs(fei?.date_mise_a_mort).format('DD/MM/YYYY')
                          : '',
                      }}
                    />
                  </div>
                  <InputNotEditable
                    label="Heure de mise à mort de la première carcasse *"
                    nativeInputProps={{
                      id: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                      name: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                      type: 'time',
                      autoComplete: 'off',
                      defaultValue: fei?.heure_mise_a_mort_premiere_carcasse ?? '',
                    }}
                  />
                </div>
                {!onlyPetitGibier && (
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Heure d'éviscération de la dernière carcasse"
                      nativeInputProps={{
                        id: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                        name: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                        type: 'time',
                        autoComplete: 'off',
                        defaultValue: fei?.heure_evisceration_derniere_carcasse ?? '',
                      }}
                    />
                  </div>
                )}
              </>
            )}
            <div className="fr-fieldset__element mb-8">
              <p className="text-sm text-gray-600">
                Veuillez cliquer sur une carcasse pour la refuser, la signaler, l'annoter
              </p>
            </div>
            {intermediaireCarcasses.map((intermediaireCarcasse) => {
              const carcasse = state.carcasses[intermediaireCarcasse.zacharie_carcasse_id];
              return (
                <Fragment key={carcasse.numero_bracelet}>
                  <CarcasseIntermediaireComp
                    intermediaire={intermediaire}
                    canEdit={canEdit}
                    carcasse={carcasse}
                  />
                </Fragment>
              );
            })}
          </Accordion>
        ) : (
          <>
            <Accordion
              titleAs="h3"
              label={`Carcasses acceptées (${carcassesApprovedSorted.length})`}
              defaultExpanded={carcassesApprovedSorted.length > 0 && needSelectNextUser}
            >
              {carcassesApprovedSorted.length === 0 ? (
                <p>Pas de carcasse acceptée</p>
              ) : (
                carcassesApprovedSorted.map((carcasse) => {
                  return (
                    <Fragment key={carcasse.numero_bracelet}>
                      <CarcasseIntermediaireComp
                        intermediaire={intermediaire}
                        canEdit={canEdit}
                        carcasse={carcasse}
                      />
                    </Fragment>
                  );
                })
              )}
            </Accordion>
            <Accordion
              titleAs="h3"
              label={`Carcasses rejetées (${carcassesSorted.carcassesRejetees.length})`}
              defaultExpanded={carcassesSorted.carcassesRejetees.length > 0 && needSelectNextUser}
            >
              {carcassesSorted.carcassesRejetees.length === 0 ? (
                <p>Pas de carcasse refusée</p>
              ) : (
                carcassesSorted.carcassesRejetees.map((carcasse) => {
                  return (
                    <Fragment key={carcasse.numero_bracelet}>
                      <CarcasseIntermediaireComp
                        intermediaire={intermediaire}
                        canEdit={canEdit}
                        carcasse={carcasse}
                      />
                    </Fragment>
                  );
                })
              )}
            </Accordion>
            <Accordion
              titleAs="h3"
              label={`Carcasses manquantes (${carcassesSorted.carcassesManquantes.length})`}
              defaultExpanded={carcassesSorted.carcassesManquantes.length > 0 && needSelectNextUser}
            >
              {carcassesSorted.carcassesManquantes.length === 0 ? (
                <p>Pas de carcasse manquante</p>
              ) : (
                carcassesSorted.carcassesManquantes.map((carcasse) => {
                  return (
                    <Fragment key={carcasse.numero_bracelet}>
                      <CarcasseIntermediaireComp
                        intermediaire={intermediaire}
                        canEdit={canEdit}
                        carcasse={carcasse}
                      />
                    </Fragment>
                  );
                })
              )}
            </Accordion>
          </>
        )}
        <Accordion
          titleAs="h3"
          label="Prise en charge des carcasses acceptées"
          defaultExpanded
          key={intermediaire?.id}
        >
          <form
            method="POST"
            id="form_intermediaire_check_finished_at"
            onBlur={handleCheckFinishedAt}
            onSubmit={handleCheckFinishedAt}
          >
            <div className={['fr-fieldset__element', canEdit ? '' : 'pointer-events-none'].join(' ')}>
              <Checkbox
                options={[
                  {
                    label: labelCheckDone,
                    hintText:
                      !intermediaire.check_finished_at && !canEdit
                        ? "Vous n'êtes pas en charge de cette fiche, vous ne pouvez pas modifier cette valeur"
                        : '',
                    nativeInputProps: {
                      required: true,
                      name: 'check_finished_at_checked',
                      value: 'true',
                      disabled: !intermediaire.check_finished_at && !canEdit,
                      form: 'form_intermediaire_check_finished_at',
                      readOnly: !!intermediaire.check_finished_at,
                      defaultChecked: intermediaire.check_finished_at ? true : false,
                    },
                  },
                ]}
              />
            </div>
            <div className={['fr-fieldset__element', canEdit ? '' : 'pointer-events-none'].join(' ')}>
              <PriseEnChargeInput
                label={
                  carcassesSorted.carcassesApproved.length > 0
                    ? 'Date de prise en charge'
                    : 'Date de décision'
                }
                // hintText={
                //   <button
                //     className="inline-block"
                //     type="button"
                //     onClick={() => {
                //       updateFeiIntermediaire(intermediaire.id, {
                //         check_finished_at: dayjs().toDate(),
                //       });
                //     }}
                //   >
                //     Vous les prenez en charge à l'instant ? <u className="inline">Cliquez ici</u> pour remplir
                //     le champ ci-dessous automatiquement
                //   </button>
                // }
                nativeInputProps={{
                  id: Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at,
                  name: Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at,
                  type: 'datetime-local',
                  form: 'form_intermediaire_check_finished_at',
                  suppressHydrationWarning: true,
                  autoComplete: 'off',
                  defaultValue: dayjs(intermediaire.check_finished_at || undefined).format(
                    'YYYY-MM-DDTHH:mm',
                  ),
                }}
              />
            </div>
            {!intermediaire.check_finished_at && (
              <div className="fr-fieldset__element">
                <Button type="submit" disabled={!canEdit}>
                  Enregistrer
                </Button>
              </div>
            )}
          </form>
        </Accordion>
        {needSelectNextUser && (
          <div className="z-50 mt-8 flex flex-col bg-white pt-4 md:px-3 md:w-auto md:items-start [&_ul]:md:min-w-96">
            <SelectNextOwnerForPremierDetenteurOrIntermediaire calledFrom="intermediaire-next-owner" />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Accordion
        titleAs="h3"
        label={`Carcasses (${originalCarcasses.length})`}
        expanded={carcassesAValiderExpanded}
        onExpandedChange={setCarcassesAValiderExpanded}
      >
        {fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO && fei.premier_detenteur_name_cache && (
          <div className="fr-fieldset__element">
            <InputNotEditable
              label="Détenteur des carcasses"
              nativeInputProps={{
                id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                autoComplete: 'off',
                defaultValue: fei.premier_detenteur_name_cache || '',
              }}
            />
          </div>
        )}
        {fei.fei_current_owner_role !== UserRoles.COLLECTEUR_PRO && (
          <>
            <div className="fr-fieldset__element">
              <div className="fr-fieldset__element">
                <InputNotEditable
                  label="Date de mise à mort (et d'éviscération) *"
                  nativeInputProps={{
                    id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                    name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                    type: 'text',
                    autoComplete: 'off',
                    suppressHydrationWarning: true,
                    defaultValue: fei?.date_mise_a_mort
                      ? dayjs(fei?.date_mise_a_mort).format('DD/MM/YYYY')
                      : '',
                  }}
                />
              </div>
              <InputNotEditable
                label="Heure de mise à mort de la première carcasse *"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                  name: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                  type: 'time',
                  autoComplete: 'off',
                  defaultValue: fei?.heure_mise_a_mort_premiere_carcasse ?? '',
                }}
              />
            </div>
            {!onlyPetitGibier && (
              <div className="fr-fieldset__element">
                <InputNotEditable
                  label="Heure d'éviscération de la dernière carcasse"
                  nativeInputProps={{
                    id: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                    name: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                    type: 'time',
                    autoComplete: 'off',
                    defaultValue: fei?.heure_evisceration_derniere_carcasse ?? '',
                  }}
                />
              </div>
            )}
          </>
        )}
        <div className="fr-fieldset__element py-20">
          <p className="text-sm text-gray-600">
            Quand vous aurez pris en charge la fiche, vous pourrez sur une carcasse pour la refuser, la
            signaler, l'annoter
          </p>
        </div>
        {originalCarcasses.map((carcasse) => {
          return <CollecteurCarcassePreview carcasse={carcasse} key={carcasse.numero_bracelet} />;
        })}
      </Accordion>
    </>
  );
}
