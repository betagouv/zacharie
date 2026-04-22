import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useParams } from 'react-router';
import { toast } from 'react-toastify';
import { Prisma, CarcasseIntermediaire, Carcasse, CarcasseStatus, EntityRelationType, EntityTypes, FeiOwnerRole } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore, { syncData } from '@app/zustand/store';
import { capture } from '@app/services/sentry';
import { getFeiAndIntermediaireIdsFromFeiIntermediaire, getFeiAndCarcasseAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiAndCarcasseAndIntermediaireIds, FeiIntermediaire } from '@app/types/fei-intermediaire';
import { useCarcassesIntermediairesForIntermediaire, useFeiIntermediaires } from '@app/utils/get-carcasses-intermediaires';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { sortCarcassesApproved } from '@app/utils/sort';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { getIntermediaireRoleLabel } from '@app/utils/get-user-roles-label';
import { addAnSToWord, formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import FEIDonneesDeChasse from '@app/routes/fei/donnees-de-chasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import FeiStepper from '@app/components/FeiStepper';
import { useEtgIds } from '@app/utils/get-entity-relations';
import DestinataireSelectIntermediaire from './etg-destinataire-select-intermediaire';
import FeiSousTraite from './etg-current-owner-sous-traite';
import CarcasseIntermediaireComp from './etg-carcasse';
import CurrentOwnerConfirm from './etg-current-owner-confirm';
import NotFound from '@app/components/NotFound';

interface Props {
  readOnly?: boolean;
}

export default function EtgFei(props: Props) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  if (!fei) {
    return <NotFound />;
  }
  return <EtgFeiLoader {...props} />;
}

function EtgFeiLoader(props: Props) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const intermediaires = useFeiIntermediaires(fei.numero);
  const feiCarcasses = useCarcassesForFei(params.fei_numero);

  const [selectedIntermediaireId, setSelectedIntermediaireId] = useState<string | null>(
    () => intermediaires.find((i) => i.intermediaire_user_id === user.id)?.id ?? null
  );

  // Update when intermediaires change (e.g., after take-charge creates new intermediaire)
  useEffect(() => {
    if (!selectedIntermediaireId && intermediaires.length > 0) {
      const found = intermediaires.find((i) => i.intermediaire_user_id === user.id);
      if (found) {
        setSelectedIntermediaireId(found.id);
      }
    }
  }, [intermediaires, selectedIntermediaireId, user.id]);

  const intermediaire = intermediaires.find((i) => i.id === selectedIntermediaireId);

  // For multi-recipient dispatch: derive next_owner_role from per-carcasse data
  const userEntityIds = useMemo(() => {
    return Object.values(entities)
      .filter((e) => e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY)
      .map((e) => e.id);
  }, [entities]);

  const myCarcasses = useMemo(() => {
    return feiCarcasses.filter((c) => (c.next_owner_entity_id && userEntityIds.includes(c.next_owner_entity_id)) || c.next_owner_user_id === user.id);
  }, [feiCarcasses, userEntityIds, user.id]);

  const myCarcassesNextOwnerRole = useMemo(() => {
    if (myCarcasses.length > 0) {
      return myCarcasses[0].next_owner_role;
    }
    return fei.fei_next_owner_role;
  }, [myCarcasses, fei.fei_next_owner_role]);

  const showInterface: FeiOwnerRole | null = useMemo(() => {
    if (fei.fei_current_owner_role === FeiOwnerRole.SVI || myCarcassesNextOwnerRole === FeiOwnerRole.SVI) {
      return FeiOwnerRole.ETG;
    }
    if (fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO && fei.fei_current_owner_user_id === user.id) {
      return FeiOwnerRole.COLLECTEUR_PRO;
    }
    if (fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO && myCarcassesNextOwnerRole === FeiOwnerRole.ETG) {
      return FeiOwnerRole.COLLECTEUR_PRO;
    }
    if (fei.fei_current_owner_role === FeiOwnerRole.ETG || myCarcassesNextOwnerRole === FeiOwnerRole.ETG) {
      return FeiOwnerRole.ETG;
    }
    if (intermediaires.length > 0) {
      const userWasIntermediaire = intermediaires.find((intermediaire) => intermediaire.intermediaire_user_id === user.id);
      if (userWasIntermediaire) {
        return userWasIntermediaire.intermediaire_role;
      }
    }
    return null;
  }, [user.id, fei.fei_current_owner_role, fei.fei_current_owner_user_id, intermediaires, myCarcassesNextOwnerRole]);

  if (!showInterface) {
    return null;
  }

  return (
    <Fragment key={intermediaire?.id}>
      <EtgFeiContent key={intermediaire?.id} {...props} intermediaire={intermediaire!}>
        {intermediaires.length > 0 && (
          <nav id="fr-breadcrumb-:r54:" role="navigation" className="fr-breadcrumb" aria-label="vous êtes ici :" data-fr-js-breadcrumb="true">
            <button className="fr-breadcrumb__button" aria-expanded="false" aria-controls="breadcrumb-:r55:" data-fr-js-collapse-button="true">
              Voir les destinataires
            </button>
            <div className="fr-collapse" id="breadcrumb-:r55:" data-fr-js-collapse="true">
              <ol className="fr-breadcrumb__list">
                <li>
                  <span className="fr-breadcrumb__link bg-none! no-underline!">{fei.premier_detenteur_name_cache}</span>
                </li>
                {intermediaires
                  .map((_intermediaire) => {
                    const entity = entities[_intermediaire.intermediaire_entity_id!];
                    let label = entity?.nom_d_usage;
                    if (entity?.type === EntityTypes.ETG && _intermediaire.intermediaire_role === FeiOwnerRole.COLLECTEUR_PRO) {
                      label += ` (${getIntermediaireRoleLabel(FeiOwnerRole.COLLECTEUR_PRO).toLowerCase()})`;
                    }

                    return (
                      <li key={_intermediaire.id}>
                        <button
                          onClick={() => setSelectedIntermediaireId(_intermediaire.id)}
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
        <Section open={!!intermediaires.length} title="Données de traçabilité">
          <FEIDonneesDeChasse />
        </Section>
      </EtgFeiContent>
    </Fragment>
  );
}

function EtgFeiContent({ intermediaire, children, ...props }: Props & { intermediaire: FeiIntermediaire; children: React.ReactNode }) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const carcasses = useZustandStore((state) => state.carcasses);
  const entities = useZustandStore((state) => state.entities);
  const etgsIds = useEtgIds();
  const fei = feis[params.fei_numero!];
  const myFeiCarcasses = useMyCarcassesForFei(fei.numero);

  const originalCarcasses = myFeiCarcasses.sort((a, b) => {
    if (a.svi_carcasse_status === CarcasseStatus.SANS_DECISION) {
      return -1;
    }
    if (b.svi_carcasse_status === CarcasseStatus.SANS_DECISION) {
      return 1;
    }
    return a.numero_bracelet.localeCompare(b.numero_bracelet);
  });

  const [showRefusedCarcasses, setShowRefusedCarcasses] = useState(false);

  const feiAndIntermediaireIds = intermediaire ? getFeiAndIntermediaireIdsFromFeiIntermediaire(intermediaire) : undefined;

  const [priseEnChargeAt, setPriseEnChargeAt] = useState<Date | null>(intermediaire?.prise_en_charge_at || null);

  useEffect(() => {
    if (!priseEnChargeAt && intermediaire?.prise_en_charge_at) {
      setPriseEnChargeAt(intermediaire.prise_en_charge_at);
    }
  }, [intermediaire, priseEnChargeAt]);

  const allIntermediaireCarcasses = useCarcassesIntermediairesForIntermediaire(feiAndIntermediaireIds);
  const intermediaireCarcasses = useMemo(() => {
    return allIntermediaireCarcasses
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
      .filter((c) => c != null && !carcasses[c.zacharie_carcasse_id]?.deleted_at);
  }, [allIntermediaireCarcasses, carcasses]);

  const warnedForIncoherentNumberOfCarcasses = useRef(false);

  const carcassesDejaRefusees = useMemo(() => {
    const intermediaireCarcassesIds = intermediaireCarcasses.map((c) => c.zacharie_carcasse_id);
    return originalCarcasses.filter(
      (c) =>
        !intermediaireCarcassesIds.includes(c.zacharie_carcasse_id) &&
        c.svi_carcasse_status !== CarcasseStatus.SANS_DECISION &&
        c.svi_carcasse_status !== CarcasseStatus.ACCEPTE
    );
  }, [originalCarcasses, intermediaireCarcasses]);

  useEffect(() => {
    if (intermediaire?.id) {
      const theoreticalNumberOfCarcassesToCheck = originalCarcasses.length - carcassesDejaRefusees.length;
      if (allIntermediaireCarcasses.length !== theoreticalNumberOfCarcassesToCheck && !warnedForIncoherentNumberOfCarcasses.current) {
        warnedForIncoherentNumberOfCarcasses.current = true;
        capture(new Error('Incoherent number of carcasses'), {
          extra: {
            allIntermediaireCarcassesLength: allIntermediaireCarcasses.length,
            originalCarcassesLength: originalCarcasses.length,
            theoreticalNumberOfCarcassesToCheck,
            intermediaireCarcassesLength: intermediaireCarcasses.length,
            carcassesDejaRefuseesLength: carcassesDejaRefusees.length,
          },
          tags: {
            fei_numero: fei.numero,
            intermediaire_id: intermediaire?.id,
          },
        });
      }
    }
  }, [
    carcassesDejaRefusees,
    carcassesDejaRefusees.length,
    allIntermediaireCarcasses,
    intermediaireCarcasses,
    originalCarcasses,
    fei.numero,
    intermediaire?.id,
  ]);

  const isEtgWorkingFor = useMemo(() => {
    if (fei.fei_current_owner_role === FeiOwnerRole.ETG && !!fei.fei_current_owner_entity_id) {
      if (etgsIds.includes(fei.fei_current_owner_entity_id)) {
        const etg = entities[fei.fei_current_owner_entity_id];
        if (etg.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          return true;
        }
      }
    }
    if (
      fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO &&
      fei.fei_next_owner_role === FeiOwnerRole.ETG &&
      !!fei.fei_next_owner_entity_id
    ) {
      if (etgsIds.includes(fei.fei_next_owner_entity_id)) {
        const etg = entities[fei.fei_next_owner_entity_id];
        if (etg.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          return true;
        }
      }
    }
    // Multi-recipient: check if any carcasse has me as next_owner
    if (fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR || fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO) {
      if (
        myFeiCarcasses.some((c) => {
          if (!c.next_owner_entity_id || !etgsIds.includes(c.next_owner_entity_id)) return false;
          const etg = entities[c.next_owner_entity_id];
          return etg?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY;
        })
      ) {
        return true;
      }
    }
    return false;
  }, [fei, etgsIds, entities, myFeiCarcasses]);

  // Multi-recipient: user may be current_owner of their carcasses even if FEI-level says otherwise
  const isCurrentOwnerOfMyCarcasses = useMemo(() => {
    return myFeiCarcasses.some((c) => c.current_owner_user_id === user.id);
  }, [myFeiCarcasses, user.id]);

  const canEdit = useMemo(() => {
    if (fei.intermediaire_closed_at || fei.svi_closed_at || fei.automatic_closed_at) {
      return false;
    }
    if (isEtgWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id && !isCurrentOwnerOfMyCarcasses) {
      return false;
    }
    if (!intermediaire) {
      return false;
    }
    if (intermediaire.intermediaire_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user, intermediaire, isEtgWorkingFor, isCurrentOwnerOfMyCarcasses]);

  const effectiveCanEdit = canEdit && !props.readOnly;
  const formattedPriseEnChargeAt = priseEnChargeAt ? dayjs(priseEnChargeAt).format('YYYY-MM-DDTHH:mm') : undefined;
  const formattedInitialPriseEnChargeAt = intermediaire?.prise_en_charge_at
    ? dayjs(intermediaire.prise_en_charge_at).format('YYYY-MM-DDTHH:mm')
    : undefined;
  const submitDisabled = !effectiveCanEdit || (formattedPriseEnChargeAt && formattedPriseEnChargeAt === formattedInitialPriseEnChargeAt);

  const PriseEnChargeInput = effectiveCanEdit ? Input : InputNotEditable;

  const carcassesSorted = useMemo(() => {
    const intermediaireCheckById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire> = {};
    for (const intermediaireCheck of intermediaireCarcasses) {
      intermediaireCheckById[getFeiAndCarcasseAndIntermediaireIds(intermediaireCheck)] = intermediaireCheck;
    }
    const carcassesApproved: Record<string, Carcasse> = {};
    const carcassesRejetees: Record<string, Carcasse> = {};
    const carcassesManquantes: Record<string, Carcasse> = {};
    const carcassesEcarteesPourInspection: Record<string, Carcasse> = {};
    // const carcassesToCheck: Record<string, Carcasse> = {};
    for (const intermediaireCarcasse of intermediaireCarcasses) {
      const checkId = getFeiAndCarcasseAndIntermediaireIds(intermediaireCarcasse);
      const carcasse = carcasses[intermediaireCarcasse.zacharie_carcasse_id];
      if (carcasse.deleted_at) {
        continue;
      }
      if (intermediaireCheckById[checkId]) {
        if (intermediaireCheckById[checkId].prise_en_charge) {
          carcassesApproved[checkId] = carcasse;
        } else if (intermediaireCheckById[checkId].manquante) {
          // console.log("MANQUANTE ICI", intermediaireCheckById[checkId]);
          carcassesManquantes[checkId] = carcasse;
        } else if (intermediaireCheckById[checkId].ecarte_pour_inspection) {
          // console.log("MANQUANTE ICI", intermediaireCheckById[checkId]);
          carcassesEcarteesPourInspection[checkId] = carcasse;
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
      carcassesEcarteesPourInspection: Object.values(carcassesEcarteesPourInspection),
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
        `Prise en charge des carcasses acceptées ou non refusées (${formatCountCarcasseByEspece(carcassesApprovedSorted)
          .filter((c) => !c?.includes('refus'))
          .join(', ')}).`
      );
    }
    if (carcassesSorted.carcassesRejetees.length > 0) {
      label.push(
        `Refus de ${formatCountCarcasseByEspece(carcassesSorted.carcassesRejetees)
          .filter((c) => c?.includes('refus'))
          .filter((c) => c != null)
          .map((c) =>
            c
              .split(' ')
              .filter((w) => !w.includes('refus'))
              .join(' ')
          )
          .join(' et ')}.`
      );
    }
    const nbCarcassesManquantes = carcassesSorted.carcassesManquantes.length;
    if (nbCarcassesManquantes > 0) {
      label.push(
        `Je signale ${nbCarcassesManquantes} ${addAnSToWord('carcasse', nbCarcassesManquantes)} ${addAnSToWord('manquante', nbCarcassesManquantes)}.`
      );
    }
    if (carcassesSorted.carcassesEcarteesPourInspection.length > 0) {
      label.push(`J'écarte ${formatCountCarcasseByEspece(carcassesSorted.carcassesEcarteesPourInspection)} pour inspection.`);
    }
    return label;
  }, [
    carcassesApprovedSorted,
    carcassesSorted.carcassesManquantes.length,
    carcassesSorted.carcassesEcarteesPourInspection,
    carcassesSorted.carcassesRejetees,
  ]);

  const couldSelectNextUser = useMemo(() => {
    if (fei.intermediaire_closed_at || fei.svi_closed_at || fei.automatic_closed_at || fei.intermediaire_closed_at) {
      return false;
    }
    if (isEtgWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id && !isCurrentOwnerOfMyCarcasses) {
      return false;
    }
    if (intermediaire?.intermediaire_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user, intermediaire, isEtgWorkingFor, isCurrentOwnerOfMyCarcasses]);

  const needSelectNextUser = useMemo(() => {
    if (!couldSelectNextUser) {
      return false;
    }
    if (carcassesSorted.carcassesApproved.length === 0 && carcassesSorted.carcassesEcarteesPourInspection.length === 0) {
      return false;
    }
    if (!priseEnChargeAt) {
      return false;
    }
    return true;
  }, [couldSelectNextUser, carcassesSorted.carcassesApproved.length, carcassesSorted.carcassesEcarteesPourInspection.length, priseEnChargeAt]);

  const canCloseFeiWithOnlyManquantesOrRejetees = useMemo(() => {
    if (!effectiveCanEdit) {
      return false;
    }
    if (fei.intermediaire_closed_at || fei.svi_closed_at || fei.automatic_closed_at) {
      return false;
    }
    // Il faut au moins une carcasse manquante ou refusée
    if (carcassesSorted.carcassesManquantes.length === 0 && carcassesSorted.carcassesRejetees.length === 0) {
      return false;
    }
    // Pas de carcasses acceptées ou écartées pour inspection
    if (carcassesSorted.carcassesApproved.length > 0 || carcassesSorted.carcassesEcarteesPourInspection.length > 0) {
      return false;
    }
    return true;
  }, [
    effectiveCanEdit,
    fei.intermediaire_closed_at,
    fei.svi_closed_at,
    fei.automatic_closed_at,
    carcassesSorted.carcassesManquantes.length,
    carcassesSorted.carcassesApproved.length,
    carcassesSorted.carcassesRejetees.length,
    carcassesSorted.carcassesEcarteesPourInspection.length,
  ]);

  function handleCloseFei() {
    if (!intermediaire || !feiAndIntermediaireIds) {
      return;
    }
    const now = dayjs().toDate();
    updateAllCarcasseIntermediaire(fei.numero, feiAndIntermediaireIds, {
      prise_en_charge_at: now,
    });
    updateFei(fei.numero, {
      intermediaire_closed_at: now,
      intermediaire_closed_by_entity_id: intermediaire.intermediaire_entity_id,
      intermediaire_closed_by_user_id: intermediaire.intermediaire_user_id,
    });
    addLog({
      user_id: user.id,
      action: 'intermediaire-close-fei-manquantes-ou-rejetees',
      fei_numero: fei.numero,
      intermediaire_id: intermediaire.id,
      history: createHistoryInput(intermediaire, {
        prise_en_charge_at: now,
        intermediaire_closed_at: now,
      }),
      user_role: intermediaire.intermediaire_role!,
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData('intermediaire-close-fei');
    toast.success('La fiche a été clôturée avec succès');
  }

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
      user_role: intermediaire.intermediaire_role!,
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
    });
    if (!carcassesSorted.carcassesApproved.length && !carcassesSorted.carcassesEcarteesPourInspection.length) {
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
    syncData('intermediaire-check-finished-at');
  }

  function handleSubmitCheckFinishedAt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    handleCheckFinishedAt(priseEnChargeAt || dayjs().toDate());
  }

  return (
    <Fragment key={intermediaire?.id}>
      <title>{`${params.fei_numero} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      {fei.deleted_at && (
        <div className="bg-error-main-525 mb-2 py-2 text-center text-white">
          <p>Fiche supprimée</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div
            className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0"
            key={fei.fei_current_owner_entity_id! + fei.fei_current_owner_user_id!}
          >
            <FeiSousTraite />
            <CurrentOwnerConfirm />
            <FeiStepper />
            {/* <Section title="Transport" key={intermediaire?.id}>
        <form
          method="POST"
          className="flex flex-col gap-y-4"
          id="form_intermediaire_check_finished_at"
          key={JSON.stringify(priseEnChargeAt || '') + JSON.stringify(labelCheckDone)}
          onSubmit={handleSubmitCheckFinishedAt}
        >
          <p>QUi a transporté les carcasses ?</p>
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
                  to: `/app/etg/`,
                }}
              >
                Voir toutes mes fiches
              </Button>
            </>
          )}
        </form>
      </Section> */}
            {children}
            {intermediaire ? (
              <Section title={`Carcasses (${intermediaireCarcasses.length})`}>
                {effectiveCanEdit && (
                  <>
                    {intermediaireCarcasses.length > 0 ? (
                      <div className="mb-8">
                        <p className="text-sm text-gray-600">Veuillez cliquer sur une carcasse pour la refuser, la signaler, l'annoter</p>
                      </div>
                    ) : (
                      <div className="mb-8">
                        <p className="text-sm text-gray-600">
                          Le chasseur a dû supprimer la carcasse sans supprimer la fiche, désolé pour le dérangement.
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div className="flex flex-col gap-4">
                  {intermediaireCarcasses.map((intermediaireCarcasse) => {
                    const carcasse = carcasses[intermediaireCarcasse.zacharie_carcasse_id];
                    return (
                      <Fragment key={carcasse.numero_bracelet}>
                        <CarcasseIntermediaireComp intermediaire={intermediaire} canEdit={effectiveCanEdit} carcasse={carcasse} />
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
                      {showRefusedCarcasses ? 'Masquer' : 'Afficher'} les carcasses déjà refusées ({carcassesDejaRefusees.length})
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
                {canCloseFeiWithOnlyManquantesOrRejetees && (
                  <div className="my-8 flex justify-center">
                    <Button onClick={handleCloseFei} priority="primary">
                      Clôturer la fiche (
                      {carcassesSorted.carcassesManquantes.length > 0 && carcassesSorted.carcassesRejetees.length > 0
                        ? 'toutes les carcasses sont manquantes ou refusées'
                        : carcassesSorted.carcassesManquantes.length > 0
                          ? 'toutes les carcasses sont manquantes'
                          : 'toutes les carcasses sont refusées'}
                      )
                    </Button>
                  </div>
                )}
              </Section>
            ) : (
              <Section title={`Carcasses (${originalCarcasses.filter((c) => c.svi_carcasse_status === CarcasseStatus.SANS_DECISION).length})`}>
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
                    <p>
                      {labelCheckDone.map((line) => {
                        return (
                          <Fragment key={line}>
                            {line}
                            <br />
                          </Fragment>
                        );
                      })}
                    </p>
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
                            <u className="inline">Cliquez ici</u> pour définir cette date comme étant aujourd'hui et maintenant
                          </button>
                        ) : null
                      }
                      label={
                        carcassesSorted.carcassesApproved.length > 0 || carcassesSorted.carcassesEcarteesPourInspection.length > 0
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
                    {!carcassesApprovedSorted.length && !carcassesSorted.carcassesEcarteesPourInspection.length && fei.intermediaire_closed_at && (
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
                            to: `/app/etg/`,
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
                    <DestinataireSelectIntermediaire
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

            <div className="m-8 flex flex-col justify-start gap-4">
              <Button
                priority="secondary"
                linkProps={{
                  to: `/app/etg/`,
                }}
              >
                Voir toutes mes fiches
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
