import { Link, useParams } from 'react-router';
import { useMemo, useState } from 'react';
import {
  UserRoles,
  Prisma,
  EntityTypes,
  DepotType,
  TransportType,
  CarcasseIntermediaire,
  EntityRelationType,
} from '@prisma/client';
import dayjs from 'dayjs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import InputNotEditable from '@app/components/InputNotEditable';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import type { FeiIntermediaire, FeiAndIntermediaireIds } from '@app/types/fei-intermediaire';

export default function DestinataireSelect({
  className = '',
  canEdit,
  transfer,
  disabled,
  calledFrom,
  feiAndIntermediaireIds,
  intermediaire,
}: {
  className?: string;
  canEdit: boolean;
  transfer?: boolean;
  disabled?: boolean;
  calledFrom: 'premier-detenteur-need-select-next' | 'current-owner-transfer' | 'intermediaire-next-owner';
  feiAndIntermediaireIds?: FeiAndIntermediaireIds;
  intermediaire?: FeiIntermediaire;
}) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const isOnline = useIsOnline();
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const ccgsIds = useZustandStore((state) => state.ccgsIds);
  const etgsIds = useZustandStore((state) => state.etgsIds);
  const svisIds = useZustandStore((state) => state.svisIds);
  const collecteursProIds = useZustandStore((state) => state.collecteursProIds);

  const fei = feis[params.fei_numero!];
  const prefilledInfos = usePrefillPremierDétenteurInfos();

  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const carcassesState = useZustandStore((state) => state.carcasses);
  const carcasses = (carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => carcassesState[cId])
    .filter((c) => !c.deleted_at);

  const ccgs = ccgsIds.map((id) => entities[id]);
  const etgs = etgsIds.map((id) => entities[id]);
  const collecteursPros = collecteursProIds.map((id) => entities[id]);
  const svis = svisIds.map((id) => entities[id]);

  const prochainsDetenteurs = useMemo(() => {
    if (fei.fei_current_owner_role === UserRoles.ETG) {
      return [...svis, ...etgs, ...collecteursPros];
    }
    return [...etgs, ...collecteursPros];
  }, [etgs, collecteursPros, svis, fei.fei_current_owner_role]);

  const canTransmitCarcassesToEntities = useMemo(() => {
    return prochainsDetenteurs.filter(
      (entity) =>
        entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY ||
        entity.relation === EntityRelationType.WORKING_FOR_ENTITY_RELATED_WITH,
    );
  }, [prochainsDetenteurs]);

  const ccgsOptions = useMemo(() => {
    return ccgs.map((entity) => ({
      label: getEntityDisplay(entity),
      value: entity.id,
    }));
  }, [ccgs]);

  const ccgsWorkingWith = useMemo(() => {
    return ccgs.filter((entity) => entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY);
  }, [ccgs]);

  const prochainsDetenteursOptions = useMemo(() => {
    return prochainsDetenteurs.map((entity) => ({
      label: getEntityDisplay(entity),
      value: entity.id,
    }));
  }, [prochainsDetenteurs]);

  const [prochainDetenteurEntityId, setProchainDetenteurEntityId] = useState(() => {
    if (fei.fei_current_owner_role === EntityTypes.PREMIER_DETENTEUR) {
      if (fei.premier_detenteur_prochain_detenteur_id_cache) {
        return fei.premier_detenteur_prochain_detenteur_id_cache;
      }
      if (prefilledInfos?.premier_detenteur_prochain_detenteur_id_cache) {
        return prefilledInfos.premier_detenteur_prochain_detenteur_id_cache;
      }
    } else {
      if (intermediaire?.intermediaire_prochain_detenteur_id_cache) {
        return intermediaire.intermediaire_prochain_detenteur_id_cache;
      }
    }
    return null;
  });

  const prochainDetenteur = prochainDetenteurEntityId ? entities[prochainDetenteurEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;
  const needTransport = useMemo(() => {
    if (transfer) return false;
    if (prochainDetenteurType === EntityTypes.SVI) return false;
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      return prochainDetenteurType !== EntityTypes.COLLECTEUR_PRO;
    }
    if (fei.fei_current_owner_role === EntityTypes.ETG) {
      return prochainDetenteurType === EntityTypes.ETG;
    }
    return false;
  }, [prochainDetenteurType, fei.fei_current_owner_role, transfer]);

  const needDepot = useMemo(() => {
    if (transfer) return false;
    if (prochainDetenteurType === EntityTypes.SVI) return false;
    if (fei.fei_current_owner_role === EntityTypes.ETG) {
      return false;
    }
    return true;
  }, [fei.fei_current_owner_role, prochainDetenteurType, transfer]);

  const [depotEntityId, setDepotEntityId] = useState(() => {
    if (!needDepot) return null;
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      if (fei.premier_detenteur_depot_entity_id) {
        return fei.premier_detenteur_depot_entity_id;
      }
      if (fei.premier_detenteur_depot_type === DepotType.AUCUN) {
        return null;
      }
      if (prefilledInfos?.premier_detenteur_depot_entity_id) {
        if (
          ccgsWorkingWith.find((entity) => entity.id === prefilledInfos.premier_detenteur_depot_entity_id)
        ) {
          return prefilledInfos.premier_detenteur_depot_entity_id;
        }
        return null;
      }
    } else {
      if (intermediaire?.intermediaire_depot_entity_id) {
        return intermediaire.intermediaire_depot_entity_id;
      }
    }
    return null;
  });

  const [depotType, setDepotType] = useState(() => {
    if (!needDepot) return null;
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
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
    } else {
      if (intermediaire?.intermediaire_depot_type) {
        return intermediaire.intermediaire_depot_type;
      }
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

  const Component = canEdit ? Input : InputNotEditable;

  const needToSubmit = useMemo(() => {
    if (!prochainDetenteurEntityId) return true;
    if (prochainDetenteurEntityId !== fei.fei_next_owner_entity_id) return true;
    if (prochainDetenteurType === EntityTypes.SVI) return false; // pas de détail pour les SVI
    // if prochain detenteur changed, need to submit
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      if (needTransport && !transportType) return true;
      if (!depotType) return true;
      if (depotType === EntityTypes.CCG && !depotEntityId) return true;
      if (transportType === TransportType.PREMIER_DETENTEUR && depotType === DepotType.CCG && !depotDate) {
        return true;
      }
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
    }
    if (fei.fei_current_owner_role === EntityTypes.COLLECTEUR_PRO) {
      if (!depotType) return true;
      if (depotType === EntityTypes.CCG && !depotEntityId) return true;
      if (depotType !== intermediaire?.intermediaire_depot_type) return true;
      if (depotEntityId !== intermediaire?.intermediaire_depot_entity_id) return true;
    }
    if (fei.fei_current_owner_role === EntityTypes.ETG) {
      if (needTransport && !transportType) return true;
    }
    return false;
  }, [
    prochainDetenteurEntityId,
    prochainDetenteurType,
    depotType,
    depotEntityId,
    needTransport,
    transportType,
    depotDate,
    fei.fei_next_owner_entity_id,
    fei.fei_current_owner_role,
    fei.premier_detenteur_depot_type,
    fei.premier_detenteur_depot_entity_id,
    fei.premier_detenteur_transport_type,
    fei.premier_detenteur_depot_ccg_at,
    fei.premier_detenteur_transport_date,
    transportDate,
    intermediaire?.intermediaire_depot_type,
    intermediaire?.intermediaire_depot_entity_id,
  ]);

  const jobIsMissing = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return 'Il manque le prochain détenteur des carcasses';
    }
    if (needDepot) {
      if (!depotType) {
        return 'Il manque le lieu de stockage des carcasses';
      }
      if (depotType === DepotType.CCG && !depotEntityId) {
        return 'Il manque le centre de collecte du gibier sauvage';
      }
      if (
        depotType === DepotType.CCG &&
        fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR &&
        !depotDate
      ) {
        return 'Il manque la date de dépôt dans le centre de collecte du gibier sauvage';
      }
    }
    if (needTransport) {
      if (!transportType) {
        return 'Il manque le type de transport';
      }
      if (
        transportType === TransportType.PREMIER_DETENTEUR &&
        depotType === DepotType.CCG &&
        !transportDate
      ) {
        return 'Il manque la date de transport';
      }
    }
    return null;
  }, [
    prochainDetenteurEntityId,
    needDepot,
    needTransport,
    depotType,
    depotEntityId,
    fei.fei_current_owner_role,
    depotDate,
    transportType,
    transportDate,
  ]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de premier détenteur pour cette fiche";
  }

  return (
    <>
      <div
        className={[
          className,
          disabled ? 'cursor-not-allowed opacity-50' : '',
          canEdit ? '' : 'cursor-not-allowed',
          'space-y-6',
        ].join(' ')}
      >
        <SelectCustom
          label="Prochain détenteur des carcasses *"
          isDisabled={disabled}
          hint={
            <>
              <span>
                Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge
                le gibier.
              </span>
              {!prochainDetenteurEntityId && !disabled && (
                <div>
                  {canTransmitCarcassesToEntities.map((entity) => {
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
        {!!prochainDetenteur && !prochainDetenteur?.zacharie_compatible && (
          <Alert
            severity="warning"
            title="Attention"
            description={`${prochainDetenteur?.nom_d_usage} n'est pas prêt pour Zacharie. Vous pouvez contacter un représentant avant de leur envoyer leur première fiche.`}
          />
        )}
        {needDepot && (
          <>
            <RadioButtons
              legend="Lieu de stockage des carcasses *"
              className={canEdit ? '' : 'radio-black'}
              disabled={!canEdit || !prochainDetenteurEntityId}
              options={[
                {
                  label: <span className="inline-block">Pas de stockage</span>,
                  hintText:
                    fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR ? (
                      <span>
                        Sans stockage en chambre froide, les carcasses doivent être transportées{' '}
                        <b>le jour-même du tir</b>
                      </span>
                    ) : (
                      <span>Les carcasses sont livrées chez le destinataire</span>
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
                      {!depotEntityId && depotType === DepotType.CCG && ccgsWorkingWith.length > 0 ? (
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
                                  },
                                }}
                              >
                                {entity.nom_d_usage}
                              </Tag>
                            );
                          })}
                        </div>
                      ) : (
                        <Link
                          className="bg-none! text-left no-underline!"
                          to={`/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`}
                        >
                          Vous n'avez pas encore renseigné votre centre de collecte ? Vous pouvez le faire en{' '}
                          <u className="inline">cliquant ici</u>
                        </Link>
                      )}
                    </>
                  }
                  options={ccgsOptions}
                  placeholder="Sélectionnez le Centre de Collecte du Gibier sauvage"
                  value={ccgsOptions.find((option) => option.value === depotEntityId) ?? null}
                  getOptionLabel={(f) => f.label!}
                  getOptionValue={(f) => f.value}
                  onChange={(f) => {
                    setDepotEntityId(f?.value ?? null);
                  }}
                  isClearable={!!depotEntityId}
                  inputId={Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}
                  classNamePrefix={`select-ccg`}
                  required
                  name={Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id}
                />
                {fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR && (
                  <Component
                    label="Date de dépôt dans le Centre de Collecte du Gibier sauvage *"
                    // click here to set now
                    disabled={depotType !== DepotType.CCG}
                    hintText={
                      canEdit ? (
                        <button
                          className="inline-block text-left"
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
                )}
              </>
            )}
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
                    <span>
                      N'oubliez pas de notifier le prochain détenteur des carcasses de votre dépôt.{' '}
                      {depotType === DepotType.AUCUN ? (
                        <>
                          Sans stockage en chambre froide, les carcasses doivent être transportées{' '}
                          <b>le jour-même du tir</b>
                        </>
                      ) : (
                        ''
                      )}
                    </span>
                  ),
                  nativeInputProps: {
                    checked: transportType === TransportType.PREMIER_DETENTEUR,
                    readOnly: !canEdit,
                    onChange: () => {
                      setTransportType(TransportType.PREMIER_DETENTEUR);
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
                        className="mr-1 inline-block text-left"
                        type="button"
                        disabled={
                          transportType !== TransportType.PREMIER_DETENTEUR || depotType !== DepotType.CCG
                        }
                        onClick={() => {
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
            disabled={disabled || !needToSubmit}
            nativeButtonProps={{
              onClick: (event) => {
                event.preventDefault();
                console.log('clicked');
                console.log({ jobIsMissing });
                if (jobIsMissing) {
                  alert(jobIsMissing);
                  return;
                }
                // for typescript only
                if (!prochainDetenteurEntityId) return;
                if (transfer) {
                  let nextFei: Partial<typeof fei> = {
                    fei_next_owner_entity_id: prochainDetenteurEntityId,
                    fei_next_owner_role: entities[prochainDetenteurEntityId]?.type,
                    fei_current_owner_wants_to_transfer: false,
                    fei_current_owner_entity_id: fei.fei_prev_owner_entity_id,
                    fei_current_owner_role: fei.fei_prev_owner_role,
                    fei_current_owner_user_id: fei.fei_prev_owner_user_id,
                  };
                  updateFei(fei.numero, nextFei);
                  addLog({
                    user_id: user.id,
                    user_role: fei.fei_current_owner_role!,
                    action: `${calledFrom}-select-destinataire-transfer`,
                    fei_numero: fei.numero,
                    history: createHistoryInput(fei, nextFei),
                    entity_id: fei.premier_detenteur_entity_id,
                    zacharie_carcasse_id: null,
                    carcasse_intermediaire_id: null,
                    intermediaire_id: null,
                  });
                  return;
                }
                if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
                  let nextFei: Partial<typeof fei> = {
                    fei_next_owner_entity_id: prochainDetenteurEntityId,
                    fei_next_owner_role: entities[prochainDetenteurEntityId]?.type,
                    premier_detenteur_prochain_detenteur_id_cache: prochainDetenteurEntityId,
                    premier_detenteur_prochain_detenteur_type_cache:
                      entities[prochainDetenteurEntityId]?.type,
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
                  for (const carcasse of carcasses) {
                    updateCarcasse(carcasse.zacharie_carcasse_id, {
                      premier_detenteur_prochain_detenteur_type_cache:
                        nextFei.premier_detenteur_prochain_detenteur_type_cache,
                      premier_detenteur_prochain_detenteur_id_cache:
                        nextFei.premier_detenteur_prochain_detenteur_id_cache,
                      premier_detenteur_depot_type: nextFei.premier_detenteur_depot_type,
                      premier_detenteur_depot_entity_id: nextFei.premier_detenteur_depot_entity_id,
                      premier_detenteur_depot_ccg_at: nextFei.premier_detenteur_depot_ccg_at,
                      premier_detenteur_transport_type: nextFei.premier_detenteur_transport_type,
                      premier_detenteur_transport_date: nextFei.premier_detenteur_transport_date,
                    });
                  }
                  updateFei(fei.numero, nextFei);
                  addLog({
                    user_id: user.id,
                    user_role: UserRoles.PREMIER_DETENTEUR,
                    action: `${calledFrom}-select-destinataire`,
                    fei_numero: fei.numero,
                    history: createHistoryInput(fei, nextFei),
                    entity_id: fei.premier_detenteur_entity_id,
                    zacharie_carcasse_id: null,
                    carcasse_intermediaire_id: null,
                    intermediaire_id: null,
                  });
                } else {
                  if (!feiAndIntermediaireIds) return;
                  let nextFei: Partial<typeof fei> = {
                    fei_next_owner_entity_id: prochainDetenteurEntityId,
                    fei_next_owner_role: entities[prochainDetenteurEntityId]?.type,
                    svi_assigned_at: prochainDetenteurType === EntityTypes.SVI ? dayjs().toDate() : null,
                    svi_entity_id:
                      prochainDetenteurType === EntityTypes.SVI ? prochainDetenteurEntityId : null,
                  };
                  updateFei(fei.numero, nextFei);
                  let nextCarcasseIntermediaire: Partial<CarcasseIntermediaire> = {
                    intermediaire_prochain_detenteur_id_cache: prochainDetenteurEntityId,
                    intermediaire_prochain_detenteur_type_cache: entities[prochainDetenteurEntityId]?.type,
                    intermediaire_depot_type: depotType,
                    intermediaire_depot_entity_id: depotType === DepotType.AUCUN ? null : depotEntityId,
                  };
                  updateAllCarcasseIntermediaire(
                    fei.numero,
                    feiAndIntermediaireIds,
                    nextCarcasseIntermediaire,
                  );
                  addLog({
                    user_id: user.id,
                    user_role: fei.fei_current_owner_role!,
                    action: `${calledFrom}-select-destinataire`,
                    fei_numero: fei.numero,
                    history: createHistoryInput(fei, nextFei),
                    entity_id: fei.fei_current_owner_entity_id,
                    zacharie_carcasse_id: null,
                    carcasse_intermediaire_id: null,
                    intermediaire_id: feiAndIntermediaireIds.split('_')[1],
                  });
                }
              },
            }}
          >
            Envoyer
          </Button>
        )}
        {!disabled && !!jobIsMissing?.length && (
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
    </>
  );
}
