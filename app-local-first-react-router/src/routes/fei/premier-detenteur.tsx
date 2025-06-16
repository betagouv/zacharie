import { useParams } from 'react-router';
import { useMemo, useState } from 'react';
import { UserRoles, Prisma, EntityTypes, DepotType, TransportType } from '@prisma/client';
import dayjs from 'dayjs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputNotEditable from '@app/components/InputNotEditable';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import Section from '@app/components/Section';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';

export default function FeiPremierDetenteur() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const ccgsIds = useZustandStore((state) => state.ccgsIds);
  const etgsIds = useZustandStore((state) => state.etgsIds);
  const collecteursProIds = useZustandStore((state) => state.collecteursProIds);
  const fei = feis[params.fei_numero!];
  const prefilledInfos = usePrefillPremierDétenteurInfos();
  const isOnline = useIsOnline();

  const premierDetenteurUser = fei.premier_detenteur_user_id ? users[fei.premier_detenteur_user_id] : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id]
    : null;

  const ccgs = ccgsIds.map((id) => entities[id]);
  const etgs = etgsIds.map((id) => entities[id]);
  const collecteursPros = collecteursProIds.map((id) => entities[id]);

  const prochainsDetenteurs = useMemo(() => {
    return [...etgs, ...collecteursPros];
  }, [etgs, collecteursPros]);

  const workingWith = useMemo(() => {
    return prochainsDetenteurs.filter((entity) => entity.relation === 'WORKING_WITH');
  }, [prochainsDetenteurs]);

  const ccgsOptions = useMemo(() => {
    return ccgs.map((entity) => ({
      label: getEntityDisplay(entity),
      value: entity.id,
    }));
  }, [ccgs]);

  const ccgsWorkingWith = useMemo(() => {
    return ccgs.filter((entity) => entity.relation === 'WORKING_WITH');
  }, [ccgs]);

  const prochainsDetenteursOptions = useMemo(() => {
    return prochainsDetenteurs.map((entity) => ({
      label: getEntityDisplay(entity),
      value: entity.id,
    }));
  }, [prochainsDetenteurs]);

  const [prochainDetenteurEntityId, setProchainDetenteurEntityId] = useState(() => {
    if (fei.premier_detenteur_prochain_detenteur_id_cache) {
      return fei.premier_detenteur_prochain_detenteur_id_cache;
    }
    if (prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache) {
      return prefilledInfos.premier_detenteur_prochain_detenteur_id_cache;
    }
    if (workingWith.length === 1) {
      return workingWith[0].id;
    }
    return null;
  });

  const prochainDetenteur = prochainDetenteurEntityId ? entities[prochainDetenteurEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;
  const needTransport = prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;

  const [depotEntityId, setDepotEntityId] = useState(() => {
    if (fei.premier_detenteur_depot_entity_id) {
      return fei.premier_detenteur_depot_entity_id;
    }
    if (fei.premier_detenteur_depot_type === DepotType.AUCUN) {
      return null;
    }
    if (prefilledInfos?.premier_detenteur_depot_entity_id) {
      if (ccgsWorkingWith.find((entity) => entity.id === prefilledInfos.premier_detenteur_depot_entity_id)) {
        return prefilledInfos.premier_detenteur_depot_entity_id;
      }
      return null;
    }
    return null;
  });

  const [depotType, setDepotType] = useState(() => {
    if (fei.premier_detenteur_depot_type) {
      return fei.premier_detenteur_depot_type;
    }
    if (fei.premier_detenteur_depot_entity_id) {
      const type = entities[fei.premier_detenteur_depot_entity_id]?.type;
      if (type === EntityTypes.CCG) {
        return DepotType.CCG;
      }
      if (type === EntityTypes.ETG) {
        return DepotType.ETG;
      }
      return null;
    }
    if (prefilledInfos?.premier_detenteur_depot_type) {
      return prefilledInfos.premier_detenteur_depot_type;
    }
    return null;
  });

  const [transportType, setTransportType] = useState(() => {
    if (fei.premier_detenteur_transport_type) {
      return fei.premier_detenteur_transport_type;
    }
    if (needTransport) {
      if (prefilledInfos?.premier_detenteur_transport_type) {
        return prefilledInfos.premier_detenteur_transport_type;
      }
    }
    return null;
  });

  const [depotDate, setDepotDate] = useState(() => {
    if (fei.premier_detenteur_depot_ccg_at) {
      return dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm');
    }
    return undefined;
  });

  const [transportDate, setTransportDate] = useState(() => {
    if (fei.premier_detenteur_transport_date) {
      return dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm');
    }
    return undefined;
  });

  const premierDetenteurInput = useMemo(() => {
    if (premierDetenteurEntity) {
      return premierDetenteurEntity.nom_d_usage;
    }
    return `${premierDetenteurUser?.prenom} ${premierDetenteurUser?.nom_de_famille}`;
  }, [premierDetenteurEntity, premierDetenteurUser]);

  const canEdit = useMemo(() => {
    if (fei.automatic_closed_at || fei.svi_signed_at || fei.svi_assigned_at || fei.intermediaire_closed_at) {
      return false;
    }
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (!user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      return false;
    }
    if (premierDetenteurEntity?.relation === 'WORKING_FOR') {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    // if (fei.premier_detenteur_depot_ccg_at) {
    //   return false;
    // }
    return true;
  }, [fei, user, premierDetenteurEntity]);

  const showAsDisabled = useMemo(() => {
    if (canEdit) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (!user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      return true;
    }
    if (premierDetenteurEntity?.relation === 'WORKING_FOR') {
      return false;
    }
    return true;
  }, [fei, user, premierDetenteurEntity, canEdit]);

  const Component = canEdit ? Input : InputNotEditable;

  const needToSubmit = useMemo(() => {
    // if no info in db yet, need to submit
    if (!prochainDetenteurEntityId) return true;
    if (!depotType) return true;
    if (depotType === EntityTypes.CCG && !depotEntityId) return true;
    console.log('ICI', transportType, fei.premier_detenteur_transport_type);
    if (needTransport && !transportType) return true;
    if (transportType === TransportType.PREMIER_DETENTEUR && depotType === DepotType.CCG && !depotDate) {
      return true;
    }
    // if prochain detenteur changed, need to submit
    if (prochainDetenteurEntityId !== fei.fei_next_owner_entity_id) return true;
    if (depotType !== fei.premier_detenteur_depot_type) return true;
    if (depotEntityId !== fei.premier_detenteur_depot_entity_id) return true;
    if (transportType !== fei.premier_detenteur_transport_type) return true;
    if (depotDate || fei.premier_detenteur_depot_ccg_at) {
      if (!depotDate) return !fei.premier_detenteur_depot_ccg_at;
      if (!fei.premier_detenteur_depot_ccg_at) return !depotDate;
      if (depotDate !== dayjs(fei.premier_detenteur_depot_ccg_at).format('YYYY-MM-DDTHH:mm')) return true;
    }
    if (transportDate || fei.premier_detenteur_transport_date) {
      if (!transportDate) return !fei.premier_detenteur_transport_date;
      if (!fei.premier_detenteur_transport_date) return !transportDate;
      if (transportDate !== dayjs(fei.premier_detenteur_transport_date).format('YYYY-MM-DDTHH:mm'))
        return true;
    }
    return false;
  }, [
    prochainDetenteurEntityId,
    depotType,
    depotEntityId,
    transportType,
    depotDate,
    transportDate,
    needTransport,
    fei.fei_next_owner_entity_id,
    fei.premier_detenteur_depot_type,
    fei.premier_detenteur_depot_entity_id,
    fei.premier_detenteur_transport_type,
    fei.premier_detenteur_depot_ccg_at,
    fei.premier_detenteur_transport_date,
  ]);

  const jobIsMissing = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return 'Il manque le prochain détenteur des carcasses';
    }
    if (!depotType) {
      return 'Il manque le lieu de stockage des carcasses';
    }
    if (depotType === DepotType.CCG && !depotEntityId) {
      return 'Il manque le centre de collecte du gibier sauvage';
    }
    if (depotType === DepotType.CCG && !depotDate) {
      return 'Il manque la date de dépôt dans le centre de collecte du gibier sauvage';
    }
    if (needTransport && !transportType) {
      return 'Il manque le type de transport';
    }
    if (
      needTransport &&
      transportType === TransportType.PREMIER_DETENTEUR &&
      depotType === DepotType.CCG &&
      !transportDate
    ) {
      return 'Il manque la date de transport';
    }
    return null;
  }, [
    prochainDetenteurEntityId,
    depotType,
    depotEntityId,
    depotDate,
    transportType,
    transportDate,
    needTransport,
  ]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de premier détenteur pour cette fiche";
  }

  return (
    <Section title={`Action du Premier détenteur | ${premierDetenteurInput}`}>
      <p className="mb-5 text-sm text-gray-500">* Les champs marqués d'une étoile sont obligatoires.</p>
      {showAsDisabled && (
        <Alert
          severity="success"
          title="En attente du premier détenteur"
          description="Vous ne pouvez pas modifier la fiche car vous n'êtes pas le Premier Détenteur"
          className="mb-5"
        />
      )}
      <div
        className={[
          showAsDisabled ? 'cursor-not-allowed opacity-50' : canEdit ? '' : 'cursor-not-allowed',
          'space-y-6',
        ].join(' ')}
      >
        <SelectCustom
          label="Prochain détenteur des carcasses *"
          hint={
            <>
              <span>
                Indiquez ici non pas le destinataire final, ni un transporteur s'il est au service d'un
                détenteur. Mais bien le prochain détenteur du gibier avec qui vous avez une transaction, le
                cas échéant pouvant aussi être le destinataire final.
              </span>
              {!prochainDetenteurEntityId && (
                <div>
                  {workingWith.map((entity) => {
                    return (
                      <Tag
                        key={entity.id}
                        iconId="fr-icon-checkbox-circle-line"
                        className="mr-2"
                        nativeButtonProps={{
                          onClick: () => setProchainDetenteurEntityId(entity.id),
                        }}
                      >
                        {entity.nom_d_usage}
                      </Tag>
                    );
                  })}
                </div>
              )}
            </>
          }
          options={prochainsDetenteursOptions}
          placeholder="Sélectionnez le prochain détenteur des carcasses"
          value={
            prochainsDetenteursOptions.find((option) => option.value === prochainDetenteurEntityId) ?? null
          }
          getOptionLabel={(f) => f.label!}
          getOptionValue={(f) => f.value}
          onChange={(f) => (f ? setProchainDetenteurEntityId(f.value) : setProchainDetenteurEntityId(null))}
          isClearable={!!prochainDetenteurEntityId}
          inputId={Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
          classNamePrefix={`select-prochain-detenteur`}
          required
          isReadOnly={!canEdit}
          name={Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
        />
        <RadioButtons
          legend="Lieu de stockage des carcasses *"
          className={canEdit ? '' : 'radio-black'}
          disabled={!canEdit || !prochainDetenteurEntityId}
          options={[
            {
              label: <span className="inline-block">Pas de stockage</span>,
              hintText: (
                <span>
                  Sans stockage en chambre froide, les carcasses doivent être transportées{' '}
                  <b>le jour-même du tir</b>
                </span>
              ),
              nativeInputProps: {
                checked: depotType === DepotType.AUCUN,
                readOnly: !canEdit,
                // disabled: !canEdit,
                onChange: () => {
                  setDepotType(DepotType.AUCUN);
                  setDepotDate(undefined);
                  setDepotEntityId(null);
                },
              },
            },
            {
              label:
                "J'ai déposé mes carcasses dans un Centre de Collecte du Gibier sauvage (chambre froide)",
              nativeInputProps: {
                checked: depotType === DepotType.CCG,
                // disabled: !canEdit,
                readOnly: !canEdit,
                onChange: () => {
                  setDepotType(DepotType.CCG);
                },
              },
            },
          ]}
        />
        {depotType === DepotType.CCG && (
          <>
            <SelectCustom
              label="Centre de Collecte du Gibier sauvage *"
              isDisabled={depotType !== DepotType.CCG}
              isReadOnly={!canEdit}
              hint={
                <>
                  {!depotEntityId && depotType === DepotType.CCG && (
                    <div>
                      {ccgsWorkingWith.map((entity) => {
                        return (
                          <Tag
                            key={entity.id}
                            iconId="fr-icon-checkbox-circle-line"
                            className="mr-2"
                            nativeButtonProps={{
                              onClick: () => {
                                setDepotEntityId(entity.id);
                                // updateFei(fei.numero, { premier_detenteur_depot_entity_id: entity.id }),
                              },
                            }}
                          >
                            {entity.nom_d_usage}
                          </Tag>
                        );
                      })}
                    </div>
                  )}
                </>
              }
              options={ccgsOptions}
              placeholder="Sélectionnez le Centre de Collecte du Gibier sauvage"
              value={ccgsOptions.find((option) => option.value === depotEntityId) ?? null}
              getOptionLabel={(f) => f.label!}
              getOptionValue={(f) => f.value}
              onChange={(f) => {
                // updateFei(fei.numero, { premier_detenteur_depot_entity_id: f?.value ?? null });
                setDepotEntityId(f?.value ?? null);
              }}
              isClearable={!!depotEntityId}
              inputId={Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}
              classNamePrefix={`select-ccg`}
              required
              name={Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}
            />
            <Component
              label="Date de dépôt dans le Centre de Collecte du Gibier sauvage *"
              // click here to set now
              disabled={depotType !== DepotType.CCG}
              hintText={
                canEdit ? (
                  <button
                    className="inline-block"
                    type="button"
                    disabled={depotType !== DepotType.CCG}
                    onClick={() => {
                      setDepotDate(dayjs().format('YYYY-MM-DDTHH:mm'));
                    }}
                  >
                    <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant
                  </button>
                ) : null
              }
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_ccg_at,
                name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_ccg_at,
                type: 'datetime-local',
                required: true,
                autoComplete: 'off',
                suppressHydrationWarning: true,
                disabled: depotType !== DepotType.CCG,
                value: depotDate,
                onChange: (e) => {
                  setDepotDate(dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'));
                },
              }}
            />
          </>
        )}
        {needTransport && (
          <>
            <RadioButtons
              legend="Qui transporte les carcasses ? *"
              className={canEdit ? '' : 'radio-black'}
              disabled={!canEdit || !prochainDetenteurEntityId}
              options={[
                {
                  label: <span className="inline-block">Je transporte les carcasses moi-même</span>,
                  hintText: (
                    <span>N'oubliez pas de notifier le prochain détenteur des carcasses de votre dépôt.</span>
                  ),
                  nativeInputProps: {
                    checked: transportType === TransportType.PREMIER_DETENTEUR,
                    readOnly: !canEdit,
                    onChange: () => {
                      setTransportType(TransportType.PREMIER_DETENTEUR);
                      // updateFei(fei.numero, {
                      //   premier_detenteur_transport_type: TransportType.PREMIER_DETENTEUR,
                      //   premier_detenteur_transport_date: null,
                      // });
                    },
                  },
                },
                {
                  label: 'Le transport est réalisé par un collecteur professionnel',
                  hintText: 'La gestion du transport est sous la responsabilité du prochain détenteur.',
                  nativeInputProps: {
                    checked: transportType === TransportType.COLLECTEUR_PRO,
                    readOnly: !canEdit,
                    onChange: () => {
                      setTransportType(TransportType.COLLECTEUR_PRO);
                      setTransportDate(undefined);
                      // updateFei(fei.numero, {
                      //   premier_detenteur_transport_type: TransportType.COLLECTEUR_PRO,
                      //   premier_detenteur_transport_date: null,
                      // });
                    },
                    disabled: !canEdit,
                  },
                },
              ]}
            />
            {transportType === TransportType.PREMIER_DETENTEUR && depotType === DepotType.CCG && (
              <Component
                label="Date à laquelle je transporte les carcasses"
                disabled={transportType !== TransportType.PREMIER_DETENTEUR || depotType !== DepotType.CCG}
                hintText={
                  canEdit ? (
                    <>
                      <button
                        className="mr-1 inline-block"
                        type="button"
                        disabled={
                          transportType !== TransportType.PREMIER_DETENTEUR || depotType !== DepotType.CCG
                        }
                        onClick={() => {
                          // updateFei(fei.numero, {
                          //   premier_detenteur_transport_date: dayjs().toDate(),
                          // });
                          setTransportDate(dayjs().format('YYYY-MM-DDTHH:mm'));
                        }}
                      >
                        <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant.
                      </button>
                      À ne remplir que si vous êtes le transporteur et que vous stockez les carcasses dans un
                      CCG. Indiquer une date permettra au prochain détenteur de s'organiser.
                    </>
                  ) : null
                }
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.premier_detenteur_transport_date,
                  name: Prisma.FeiScalarFieldEnum.premier_detenteur_transport_date,
                  type: 'datetime-local',
                  required: true,
                  autoComplete: 'off',
                  suppressHydrationWarning: true,
                  value: transportDate,
                  onChange: (e) => {
                    setTransportDate(dayjs(e.target.value).format('YYYY-MM-DDTHH:mm'));
                  },
                }}
              />
            )}
          </>
        )}
        {canEdit && (
          <Button
            className="mt-4"
            type="submit"
            disabled={!needToSubmit}
            nativeButtonProps={{
              onClick: (event) => {
                event.preventDefault();
                if (jobIsMissing) {
                  alert(jobIsMissing);
                  return;
                }
                // for typescript only
                if (!prochainDetenteurEntityId) return;
                let nextFei: Partial<typeof fei> = {
                  fei_next_owner_entity_id: prochainDetenteurEntityId,
                  fei_next_owner_role: entities[prochainDetenteurEntityId]?.type,
                  premier_detenteur_prochain_detenteur_id_cache: prochainDetenteurEntityId,
                  premier_detenteur_prochain_detenteur_type_cache: entities[prochainDetenteurEntityId]?.type,
                  premier_detenteur_depot_type: depotType,
                  premier_detenteur_depot_entity_id: depotType === DepotType.AUCUN ? null : depotEntityId,
                  premier_detenteur_depot_ccg_at: depotDate ? dayjs(depotDate).toDate() : null,
                  premier_detenteur_transport_type: needTransport ? transportType : null,
                  premier_detenteur_transport_date: needTransport
                    ? transportDate
                      ? dayjs(transportDate).toDate()
                      : null
                    : null,
                };
                updateFei(fei.numero, nextFei);
                addLog({
                  user_id: user.id,
                  user_role: UserRoles.PREMIER_DETENTEUR,
                  action: 'premier-detenteur-depot',
                  fei_numero: fei.numero,
                  history: createHistoryInput(fei, nextFei),
                  entity_id: fei.premier_detenteur_entity_id,
                  zacharie_carcasse_id: null,
                  carcasse_intermediaire_id: null,
                  fei_intermediaire_id: null,
                });
              },
            }}
          >
            Envoyer
          </Button>
        )}
        {!!jobIsMissing?.length && (
          <Alert title="Attention" className="mt-4" severity="error" description={jobIsMissing} />
        )}
        {canEdit && !needToSubmit && fei.fei_next_owner_entity_id && (
          <>
            <Alert
              className="mt-6"
              severity="success"
              description={`${entities[fei.fei_next_owner_entity_id]?.nom_d_usage} ${fei.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
              title="Attribution effectuée"
            />
          </>
        )}
      </div>
    </Section>
  );
}
