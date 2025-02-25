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
import { Alert } from '@codegouvfr/react-dsfr/Alert';

export default function FEICurrentIntermediaire() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFeiIntermediaire = useZustandStore((state) => state.updateFeiIntermediaire);
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const feis = useZustandStore((state) => state.feis);
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcassesIntermediaires = useZustandStore((state) => state.carcassesIntermediaires);
  const carcassesIntermediairesByIntermediaire = useZustandStore(
    (state) => state.carcassesIntermediairesByIntermediaire,
  );
  const entities = useZustandStore((state) => state.entities);
  const etgsIds = useZustandStore((state) => state.etgsIds);
  const users = useZustandStore((state) => state.users);
  const fei = feis[params.fei_numero!];
  const originalCarcasses = (carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => carcasses[cId])
    .filter((c) => !c.deleted_at);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);

  const [intermediaireIndex, setIntermediaireIndex] = useState(0);
  const intermediaire = intermediaires[intermediaireIndex];

  const intermediaireCarcasses = useMemo(() => {
    return [...new Set(carcassesIntermediairesByIntermediaire[intermediaire?.id] || [])]
      .map(
        (fei_numero__bracelet__intermediaire_id) =>
          carcassesIntermediaires[fei_numero__bracelet__intermediaire_id],
      )
      .sort((carcasseIntermediaireA, carcasseIntermediaireB) => {
        // sort by espece then by numero_bracelet
        const carcasseA = carcasses[carcasseIntermediaireA.zacharie_carcasse_id]!;
        const carcasseB = carcasses[carcasseIntermediaireB.zacharie_carcasse_id]!;
        if (carcasseA.espece === carcasseB.espece) {
          return carcasseA.numero_bracelet.localeCompare(carcasseB.numero_bracelet);
        }
        if (carcasseA.type === carcasseB.type) {
          return carcasseA.espece!.localeCompare(carcasseB.espece!);
        }
        return carcasseA.type!.localeCompare(carcasseB.type!);
      })
      .filter((c) => c != null);
  }, [intermediaire, carcassesIntermediairesByIntermediaire, carcassesIntermediaires, carcasses]);

  const isEtgWorkingFor = useMemo(() => {
    if (fei.fei_current_owner_role === UserRoles.ETG && !!fei.fei_current_owner_entity_id) {
      if (user.roles.includes(UserRoles.ETG)) {
        if (etgsIds.includes(fei.fei_current_owner_entity_id)) {
          const etg = entities[fei.fei_current_owner_entity_id];
          if (etg.relation === 'WORKING_FOR') {
            return true;
          }
        }
      }
    }
    return false;
  }, [fei, user, etgsIds, entities]);

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
      const carcasse = carcasses[intermediaireCarcasse.zacharie_carcasse_id];
      if (carcasse.deleted_at) {
        continue;
      }
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
  }, [intermediaireCarcasses, intermediaire, fei, carcasses]);

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
    if (carcassesSorted.carcassesApproved.length === 0) {
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
  }, [fei, user, intermediaire, intermediaires, isEtgWorkingFor, carcassesSorted.carcassesApproved.length]);

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

  function handleCheckFinishedAt(checkFinishedAt: Date) {
    if (!intermediaire) {
      return;
    }
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
    if (!carcassesSorted.carcassesApproved.length) {
      updateFei(fei.numero, {
        intermediaire_closed_at: checkFinishedAt,
        intermediaire_closed_by_entity_id: intermediaire.fei_intermediaire_entity_id,
        intermediaire_closed_by_user_id: intermediaire.fei_intermediaire_user_id,
      });
    } else {
      updateFei(fei.numero, {
        intermediaire_closed_at: null,
        intermediaire_closed_by_entity_id: null,
        intermediaire_closed_by_user_id: null,
      });
    }
  }

  function handleSubmitCheckFinishedAt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    handleCheckFinishedAt(dayjs().toDate());
  }

  const showCollecteurInterface =
    fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO && fei.fei_current_owner_user_id === user.id;

  if (intermediaire) {
    return (
      <>
        {!showCollecteurInterface && (
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
                          {entities[_intermediaire.fei_intermediaire_entity_id!]?.nom_d_usage}
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
            user={users[intermediaire.fei_intermediaire_user_id!]!}
            entity={entities[intermediaire.fei_intermediaire_entity_id!]!}
          />
        </Accordion>
        {canEdit ? (
          <Accordion
            titleAs="h3"
            label={`Carcasses (${intermediaireCarcasses.length})`}
            expanded={carcassesAValiderExpanded}
            onExpandedChange={setCarcassesAValiderExpanded}
          >
            {showCollecteurInterface && fei.premier_detenteur_name_cache && (
              <>
                <InputNotEditable
                  label="Détenteur des carcasses"
                  nativeInputProps={{
                    id: Prisma.EntityScalarFieldEnum.nom_d_usage,
                    name: Prisma.EntityScalarFieldEnum.nom_d_usage,
                    autoComplete: 'off',
                    defaultValue: fei.premier_detenteur_name_cache || '',
                  }}
                />
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
              </>
            )}
            {!showCollecteurInterface && (
              <>
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
                {!onlyPetitGibier && (
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
                )}
              </>
            )}
            <div className="mb-8">
              <p className="text-sm text-gray-600">
                Veuillez cliquer sur une carcasse pour la refuser, la signaler, l'annoter
              </p>
            </div>
            {intermediaireCarcasses.map((intermediaireCarcasse) => {
              const carcasse = carcasses[intermediaireCarcasse.zacharie_carcasse_id];
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
            onSubmit={handleSubmitCheckFinishedAt}
          >
            <Checkbox
              className={canEdit ? '' : 'pointer-events-none'}
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
            <PriseEnChargeInput
              key={JSON.stringify(intermediaire.check_finished_at || '')}
              className={canEdit ? '' : 'pointer-events-none'}
              hintText={
                canEdit ? (
                  <button
                    className="inline-block"
                    type="button"
                    onClick={() => {
                      handleCheckFinishedAt(dayjs().toDate());
                    }}
                  >
                    <u className="inline">Cliquez ici</u> pour définir cette date comme étant aujourd'hui et
                    maintenant
                  </button>
                ) : (
                  "Cette date vaut date d'approbation de mise sur le marché"
                )
              }
              label={
                carcassesSorted.carcassesApproved.length > 0 ? 'Date de prise en charge' : 'Date de décision'
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
                defaultValue: dayjs(intermediaire.check_finished_at || undefined).format('YYYY-MM-DDTHH:mm'),
              }}
            />
            <Button type="submit" disabled={!canEdit}>
              Enregistrer
            </Button>
            {!carcassesApprovedSorted.length && fei.intermediaire_closed_at && (
              <>
                <Alert
                  severity="info"
                  className="mt-6"
                  description="Vous n'avez pas pris en charge de carcasse acceptée, la fiche est donc clôturée."
                  title="Aucune carcasse acceptée"
                />
                <Button
                  className="mt-6"
                  linkProps={{
                    to: `/app/tableau-de-bord/`,
                  }}
                >
                  Voir toutes mes fiches
                </Button>
              </>
            )}
          </form>
        </Accordion>
        <Accordion
          titleAs="h3"
          label={`Sélection du prochain destinataire`}
          defaultExpanded
          key={intermediaire?.id + needSelectNextUser}
        >
          <SelectNextOwnerForPremierDetenteurOrIntermediaire
            calledFrom="intermediaire-next-owner"
            disabled={!needSelectNextUser}
          />
        </Accordion>
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
        {showCollecteurInterface && fei.premier_detenteur_name_cache && (
          <InputNotEditable
            label="Détenteur des carcasses"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.nom_d_usage,
              name: Prisma.EntityScalarFieldEnum.nom_d_usage,
              autoComplete: 'off',
              defaultValue: fei.premier_detenteur_name_cache || '',
            }}
          />
        )}
        {!showCollecteurInterface && (
          <>
            <InputNotEditable
              label="Date de mise à mort (et d'éviscération) *"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                type: 'text',
                autoComplete: 'off',
                suppressHydrationWarning: true,
                defaultValue: fei?.date_mise_a_mort ? dayjs(fei?.date_mise_a_mort).format('DD/MM/YYYY') : '',
              }}
            />
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
            {!onlyPetitGibier && (
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
            )}
          </>
        )}
        <div className="py-20">
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
