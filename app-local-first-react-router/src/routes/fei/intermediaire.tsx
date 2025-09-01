import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Prisma,
  CarcasseIntermediaire,
  Carcasse,
  UserRoles,
  CarcasseStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
} from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import dayjs from 'dayjs';
import CarcasseIntermediaireComp from './intermediaire-carcasse';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import {
  getFeiAndIntermediaireIdsFromFeiIntermediaire,
  getFeiAndCarcasseAndIntermediaireIds,
} from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiAndCarcasseAndIntermediaireIds, FeiIntermediaire } from '@app/types/fei-intermediaire';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { sortCarcassesApproved } from '@app/utils/sort';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import FEIDonneesDeChasse from './donnees-de-chasse';
import { addAnSToWord, formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import DestinataireSelect from './destinataire-select';
import { getIntermediaireRoleLabel } from '@app/utils/get-user-roles-label';

interface Props {
  readOnly?: boolean;
}

export default function FEICurrentIntermediaire(props: Props) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);

  const [intermediaireIndex, setIntermediaireIndex] = useState(() => {
    const userWasIntermediaire = intermediaires.find((intermediaire) =>
      intermediaire.intermediaire_user_id.startsWith(user.id),
    );
    if (userWasIntermediaire) {
      return intermediaires.indexOf(userWasIntermediaire);
    }
    return 0;
  });
  const intermediaire = intermediaires[intermediaireIndex];

  return (
    <Fragment key={intermediaire?.id}>
      {user.roles.includes(UserRoles.ETG) && intermediaires.length > 0 && (
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
                <span className="fr-breadcrumb__link bg-none! no-underline!">
                  {fei.premier_detenteur_name_cache}
                </span>
              </li>
              {intermediaires
                .map((_intermediaire, index) => {
                  const entity = entities[_intermediaire.intermediaire_entity_id!];
                  let label = entity?.nom_d_usage;
                  if (
                    entity?.type === EntityTypes.ETG &&
                    _intermediaire.intermediaire_role === FeiOwnerRole.COLLECTEUR_PRO
                  ) {
                    label += ` (${getIntermediaireRoleLabel(FeiOwnerRole.COLLECTEUR_PRO).toLowerCase()})`;
                  }

                  return (
                    <li key={_intermediaire.id}>
                      <button
                        onClick={() => setIntermediaireIndex(index)}
                        className="fr-breadcrumb__link"
                        aria-current={_intermediaire.id === intermediaire?.id ? 'step' : false}
                        disabled={props.readOnly}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })
                .reverse()}
            </ol>
          </div>
        </nav>
      )}

      <Section open={!!intermediaires.length} title="Données de chasse">
        <FEIDonneesDeChasse />
      </Section>
      <FEICurrentIntermediaireContent
        key={intermediaire?.id}
        {...props}
        intermediaire={intermediaire}
        intermediaireIndex={intermediaireIndex}
      />
    </Fragment>
  );
}

function FEICurrentIntermediaireContent({
  intermediaire,
  intermediaireIndex,
  ...props
}: Props & { intermediaire: FeiIntermediaire; intermediaireIndex: number }) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const feis = useZustandStore((state) => state.feis);
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const carcasses = useZustandStore((state) => state.carcasses);
  const entities = useZustandStore((state) => state.entities);
  const etgsIds = useZustandStore((state) => state.etgsIds);
  const carcassesIntermediaireIdsByIntermediaire = useZustandStore(
    (state) => state.carcassesIntermediaireIdsByIntermediaire,
  );
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const fei = feis[params.fei_numero!];
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);

  const originalCarcasses = (carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => carcasses[cId])
    .sort((a, b) => {
      if (a.svi_carcasse_status === CarcasseStatus.SANS_DECISION) {
        return -1;
      }
      if (b.svi_carcasse_status === CarcasseStatus.SANS_DECISION) {
        return 1;
      }
      return a.numero_bracelet.localeCompare(b.numero_bracelet);
    })
    .filter((c) => !c.deleted_at);

  const [showRefusedCarcasses, setShowRefusedCarcasses] = useState(false);

  const feiAndIntermediaireIds = intermediaire
    ? getFeiAndIntermediaireIdsFromFeiIntermediaire(intermediaire)
    : undefined;

  const [priseEnChargeAt, setPriseEnChargeAt] = useState<Date | null>(
    intermediaire?.prise_en_charge_at || null,
  );
  useEffect(() => {
    if (!priseEnChargeAt && intermediaire?.prise_en_charge_at) {
      console.log('RESET PRISE EN CHARGE AT', intermediaire.prise_en_charge_at);
      setPriseEnChargeAt(intermediaire.prise_en_charge_at);
    }
  }, [intermediaire, priseEnChargeAt]);

  const intermediaireCarcasses = useMemo(() => {
    const carcassesIntermediaireIds =
      (!!feiAndIntermediaireIds && carcassesIntermediaireIdsByIntermediaire[feiAndIntermediaireIds]) || [];

    return carcassesIntermediaireIds
      .map((id) => carcassesIntermediaireById[id])
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
  }, [
    carcassesIntermediaireIdsByIntermediaire,
    feiAndIntermediaireIds,
    carcassesIntermediaireById,
    carcasses,
  ]);

  const carcassesDejaRefusees = useMemo(() => {
    const intermediaireCarcassesIds = intermediaireCarcasses.map((c) => c.zacharie_carcasse_id);
    return originalCarcasses.filter(
      (c) =>
        !intermediaireCarcassesIds.includes(c.zacharie_carcasse_id) &&
        c.svi_carcasse_status !== CarcasseStatus.SANS_DECISION &&
        c.svi_carcasse_status !== CarcasseStatus.ACCEPTE,
    );
  }, [originalCarcasses, intermediaireCarcasses]);

  const isEtgWorkingFor = useMemo(() => {
    if (fei.fei_current_owner_role === UserRoles.ETG && !!fei.fei_current_owner_entity_id) {
      if (user.roles.includes(UserRoles.ETG)) {
        if (etgsIds.includes(fei.fei_current_owner_entity_id)) {
          const etg = entities[fei.fei_current_owner_entity_id];
          if (etg.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
            return true;
          }
        }
      }
    }
    if (
      fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO &&
      fei.fei_next_owner_role === UserRoles.ETG &&
      !!fei.fei_next_owner_entity_id
    ) {
      if (user.roles.includes(UserRoles.ETG)) {
        if (etgsIds.includes(fei.fei_next_owner_entity_id)) {
          const etg = entities[fei.fei_next_owner_entity_id];
          if (etg.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
            return true;
          }
        }
      }
    }
    return false;
  }, [fei, user, etgsIds, entities]);

  const canEdit = useMemo(() => {
    if (fei.intermediaire_closed_at || fei.svi_closed_at || fei.automatic_closed_at) {
      return false;
    }
    if (isEtgWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!intermediaire) {
      return false;
    }
    if (intermediaire.intermediaire_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user, intermediaire, isEtgWorkingFor]);

  const effectiveCanEdit = canEdit && !props.readOnly;
  const formattedPriseEnChargeAt = priseEnChargeAt
    ? dayjs(priseEnChargeAt).format('YYYY-MM-DDTHH:mm')
    : undefined;
  const formattedInitialPriseEnChargeAt = intermediaire?.prise_en_charge_at
    ? dayjs(intermediaire.prise_en_charge_at).format('YYYY-MM-DDTHH:mm')
    : undefined;
  const submitDisabled =
    !effectiveCanEdit ||
    (formattedPriseEnChargeAt && formattedPriseEnChargeAt === formattedInitialPriseEnChargeAt);

  const PriseEnChargeInput = effectiveCanEdit ? Input : InputNotEditable;

  const carcassesSorted = useMemo(() => {
    const intermediaireCheckById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire> = {};
    for (const intermediaireCheck of intermediaireCarcasses) {
      intermediaireCheckById[getFeiAndCarcasseAndIntermediaireIds(intermediaireCheck)] = intermediaireCheck;
    }
    const carcassesApproved: Record<string, Carcasse> = {};
    const carcassesRejetees: Record<string, Carcasse> = {};
    const carcassesManquantes: Record<string, Carcasse> = {};
    // const carcassesToCheck: Record<string, Carcasse> = {};
    for (const intermediaireCarcasse of intermediaireCarcasses) {
      const checkId = getFeiAndCarcasseAndIntermediaireIds(intermediaireCarcasse);
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
  }, [intermediaireCarcasses, intermediaire, carcasses]);

  const carcassesApprovedSorted = useMemo(() => {
    return carcassesSorted.carcassesApproved.sort(sortCarcassesApproved);
  }, [carcassesSorted.carcassesApproved]);

  const labelCheckDone = useMemo(() => {
    let label = [];
    if (carcassesApprovedSorted.length > 0) {
      label.push(
        `${priseEnChargeAt ? "J'ai pris" : 'Je prends'} en charge les carcasses que j'ai acceptées (${formatCountCarcasseByEspece(
          carcassesApprovedSorted,
        )
          .filter((c) => !c?.includes('refus'))
          .join(', ')}).`,
      );
    }
    if (carcassesSorted.carcassesRejetees.length > 0) {
      label.push(
        `J'ai refusé ${formatCountCarcasseByEspece(carcassesSorted.carcassesRejetees)
          .filter((c) => c?.includes('refus'))
          .filter((c) => c != null)
          .map((c) =>
            c
              .split(' ')
              .filter((w) => !w.includes('refus'))
              .join(' '),
          )
          .join(' et ')}.`,
      );
    }
    const nbCarcassesManquantes = carcassesSorted.carcassesManquantes.length;
    if (nbCarcassesManquantes > 0) {
      label.push(
        `J'ai signalé ${nbCarcassesManquantes} ${addAnSToWord('carcasse', nbCarcassesManquantes)} ${addAnSToWord('manquante', nbCarcassesManquantes)}.`,
      );
    }
    return label;
  }, [
    carcassesApprovedSorted,
    carcassesSorted.carcassesManquantes.length,
    carcassesSorted.carcassesRejetees,
    priseEnChargeAt,
  ]);

  const couldSelectNextUser = useMemo(() => {
    if (
      fei.intermediaire_closed_at ||
      fei.svi_closed_at ||
      fei.automatic_closed_at ||
      fei.intermediaire_closed_at
    ) {
      return false;
    }
    if (intermediaireIndex !== 0) {
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
  }, [fei, user, intermediaire, intermediaires, isEtgWorkingFor, intermediaireIndex]);

  const needSelectNextUser = useMemo(() => {
    if (!couldSelectNextUser) {
      return false;
    }
    if (carcassesSorted.carcassesApproved.length === 0) {
      return false;
    }
    if (!priseEnChargeAt) {
      return false;
    }
    return true;
  }, [couldSelectNextUser, carcassesSorted.carcassesApproved.length, priseEnChargeAt]);

  function handleCheckFinishedAt(_priseEnChargeAt: Date) {
    if (!feiAndIntermediaireIds) {
      return;
    }
    setPriseEnChargeAt(_priseEnChargeAt);
    updateAllCarcasseIntermediaire(fei.numero, feiAndIntermediaireIds, {
      prise_en_charge_at: _priseEnChargeAt,
    });
    addLog({
      user_id: user.id,
      action: 'intermediaire-check-finished-at',
      fei_numero: fei.numero,
      intermediaire_id: intermediaire?.id,
      history: createHistoryInput(intermediaire, {
        prise_en_charge_at: _priseEnChargeAt,
      }),
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
    });
    if (!carcassesSorted.carcassesApproved.length) {
      updateFei(fei.numero, {
        intermediaire_closed_at: _priseEnChargeAt,
        intermediaire_closed_by_entity_id: intermediaire.intermediaire_entity_id,
        intermediaire_closed_by_user_id: intermediaire.intermediaire_user_id,
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
    handleCheckFinishedAt(priseEnChargeAt || dayjs().toDate());
  }

  return (
    <Fragment key={intermediaire?.id}>
      {intermediaire ? (
        <Section title={`Carcasses (${intermediaireCarcasses.length})`}>
          {effectiveCanEdit && (
            <div className="mb-8">
              <p className="text-sm text-gray-600">
                Veuillez cliquer sur une carcasse pour la refuser, la signaler, l'annoter
              </p>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {intermediaireCarcasses.map((intermediaireCarcasse) => {
              const carcasse = carcasses[intermediaireCarcasse.zacharie_carcasse_id];
              return (
                <Fragment key={carcasse.numero_bracelet}>
                  <CarcasseIntermediaireComp
                    intermediaire={intermediaire}
                    canEdit={effectiveCanEdit}
                    carcasse={carcasse}
                  />
                </Fragment>
              );
            })}
          </div>
          {carcassesDejaRefusees.length > 0 && (
            <div className="my-8 flex justify-center">
              <Button
                onClick={() => {
                  setShowRefusedCarcasses(!showRefusedCarcasses);
                }}
                priority="secondary"
              >
                {showRefusedCarcasses ? 'Masquer' : 'Afficher'} les carcasses déjà refusées (
                {carcassesDejaRefusees.length})
              </Button>
            </div>
          )}
          {showRefusedCarcasses && (
            <div className="flex flex-col gap-4">
              {carcassesDejaRefusees.map((carcasse) => {
                return <CardCarcasse carcasse={carcasse} key={carcasse.numero_bracelet} />;
              })}
            </div>
          )}
        </Section>
      ) : (
        <Section
          title={`Carcasses (${originalCarcasses.filter((c) => c.svi_carcasse_status === CarcasseStatus.SANS_DECISION).length})`}
        >
          <div className="flex flex-col gap-4">
            {originalCarcasses
              .filter((c) => c.svi_carcasse_status === CarcasseStatus.SANS_DECISION)
              .map((carcasse) => {
                return (
                  <Fragment key={carcasse.numero_bracelet}>
                    <CardCarcasse
                      carcasse={carcasse}
                      key={carcasse.numero_bracelet}
                      className="[zoom:1.3] [&_.text-manquante]:text-gray-500! [&.border-manquante]:border-gray-500!"
                    />
                  </Fragment>
                );
              })}
          </div>
        </Section>
      )}

      {!!labelCheckDone.length && (
        <>
          <Section title="Prise en charge des carcasses acceptées" key={intermediaire?.id}>
            <form
              method="POST"
              className="flex flex-col gap-y-4"
              id="form_intermediaire_check_finished_at"
              key={JSON.stringify(priseEnChargeAt || '') + JSON.stringify(labelCheckDone)}
              onSubmit={handleSubmitCheckFinishedAt}
            >
              <Checkbox
                className={!priseEnChargeAt ? '' : 'checkbox-black'}
                options={[
                  {
                    label: (
                      <>
                        {labelCheckDone.map((line) => {
                          return (
                            <span className="block basis-full" key={line}>
                              {line}
                            </span>
                          );
                        })}
                      </>
                    ),
                    nativeInputProps: {
                      required: true,
                      name: 'check_finished_at_checked',
                      value: 'true',
                      disabled: !!priseEnChargeAt,
                      form: 'form_intermediaire_check_finished_at',
                      readOnly: !!priseEnChargeAt || props.readOnly,
                      defaultChecked: priseEnChargeAt ? true : false,
                    },
                  },
                ]}
              />
              <PriseEnChargeInput
                className={effectiveCanEdit ? '' : 'pointer-events-none'}
                hintText={
                  effectiveCanEdit ? (
                    <button
                      className="inline-block"
                      type="button"
                      onClick={() => {
                        setPriseEnChargeAt(dayjs().toDate());
                      }}
                    >
                      <u className="inline">Cliquez ici</u> pour définir cette date comme étant aujourd'hui et
                      maintenant
                    </button>
                  ) : null
                }
                label={
                  carcassesSorted.carcassesApproved.length > 0
                    ? 'Date de prise en charge'
                    : 'Date de décision'
                }
                nativeInputProps={{
                  id: Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at,
                  name: Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at,
                  type: 'datetime-local',
                  form: 'form_intermediaire_check_finished_at',
                  suppressHydrationWarning: true,
                  autoComplete: 'off',
                  value: formattedPriseEnChargeAt,
                  onChange: (e) => {
                    setPriseEnChargeAt(dayjs(e.target.value).toDate());
                  },
                }}
              />
              {!!canEdit && (
                <Button type="submit" disabled={!!submitDisabled}>
                  Enregistrer
                </Button>
              )}
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
          </Section>
          {couldSelectNextUser && (
            <Section title="Sélection du prochain destinataire" key={intermediaire?.id + needSelectNextUser}>
              <DestinataireSelect
                calledFrom="intermediaire-next-owner"
                disabled={!needSelectNextUser || props.readOnly}
                canEdit={effectiveCanEdit}
                feiAndIntermediaireIds={feiAndIntermediaireIds}
                intermediaire={intermediaire}
                key={intermediaire?.intermediaire_prochain_detenteur_id_cache}
              />
            </Section>
          )}
        </>
      )}
    </Fragment>
  );
}
