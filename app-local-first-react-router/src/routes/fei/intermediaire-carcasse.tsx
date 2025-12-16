import { Fragment, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { CarcasseType, Prisma, UserRoles, type Carcasse } from '@prisma/client';
import refusIntermedaire from '@app/data/refus-intermediaire.json';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
// import InputForSearchPrefilledData from '@app/components/InputForSearchPrefilledData';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import useZustandStore from '@app/zustand/store';
import { getFeiAndCarcasseAndIntermediaireIdsFromCarcasse } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiIntermediaire } from '@app/types/fei-intermediaire';
import { createHistoryInput } from '@app/utils/create-history-entry';
import useUser from '@app/zustand/user';
import dayjs from 'dayjs';
import CardCarcasse from '@app/components/CardCarcasse';
import InputMultiSelect from '@app/components/InputMultiSelect';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';

interface CarcasseIntermediaireProps {
  carcasse: Carcasse;
  canEdit: boolean;
  intermediaire: FeiIntermediaire;
}

export default function CarcasseIntermediaireComp({
  carcasse,
  canEdit,
  intermediaire,
}: CarcasseIntermediaireProps) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateCarcasseIntermediaire = useZustandStore((state) => state.updateCarcasseIntermediaire);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const fei = useZustandStore((state) => state.feis[params.fei_numero!]);
  const entities = useZustandStore((state) => state.entities);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const carcasseIntermediaireId = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
    carcasse,
    intermediaire.id,
  );
  const carcasseIntermediaire = carcassesIntermediaireById[carcasseIntermediaireId];
  const getCarcassesIntermediairesForCarcasse = useZustandStore(
    (state) => state.getCarcassesIntermediairesForCarcasse,
  );
  const carcassesIntermediaires = getCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id!);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const _carcasseIntermediaire of carcassesIntermediaires) {
      if (_carcasseIntermediaire.intermediaire_id === carcasseIntermediaire.intermediaire_id) continue;
      if (_carcasseIntermediaire?.commentaire) {
        const intermediaireEntity = entities[_carcasseIntermediaire.intermediaire_entity_id];
        commentaires.push(
          `${intermediaireEntity?.nom_d_usage}\u00A0: ${_carcasseIntermediaire?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities, carcasseIntermediaire]);

  const formRef = useRef<HTMLFormElement>(null);

  const refusIntermediaireModal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `refus-intermediaire-modal-carcasse-${carcasseIntermediaireId}`,
    }),
  ).current;
  const isRefusIntermediaireModalOpen = useIsModalOpen(refusIntermediaireModal);

  const [carcasseManquante, setCarcasseManquante] = useState(!!carcasse.intermediaire_carcasse_manquante);
  const [carcasseRefusCheckbox, setCarcasseRefusCheckbox] = useState(!!carcasseIntermediaire.refus);
  const [carcasseEcarteePourInspectionCheckbox, setCarcasseEcarteePourInspectionCheckbox] = useState(
    !!carcasseIntermediaire.ecarte_pour_inspection,
  );
  const [carcasseAcceptPartielCheckbox, setCarcasseAcceptPartielCheckbox] = useState(
    !!carcasseIntermediaire.check_manuel &&
      !carcasseIntermediaire.refus &&
      !carcasse.intermediaire_carcasse_manquante &&
      carcasse.type === CarcasseType.PETIT_GIBIER &&
      carcasseIntermediaire.nombre_d_animaux_acceptes !== null &&
      carcasseIntermediaire.nombre_d_animaux_acceptes !== (carcasse.nombre_d_animaux ?? 0),
  );
  const [refus, setRefus] = useState(
    carcasse.intermediaire_carcasse_refus_motif ?? carcasseIntermediaire.refus ?? '',
  );
  const [commentaire, setCommentaire] = useState(carcasseIntermediaire.commentaire ?? '');
  const [poids, setPoids] = useState(carcasseIntermediaire.intermediaire_poids ?? '');

  const nombreAnimauxTotal = carcasse.nombre_d_animaux ?? 0;
  // Prioriser la valeur de CarcasseIntermediaire si disponible, sinon celle de Carcasse
  const nombreAnimauxAccepteFromDb = carcasseIntermediaire.nombre_d_animaux_acceptes ?? null;

  // Si le lot est refusé, préremplir avec 0 acceptés
  const isLotRefuse = !!carcasseIntermediaire.refus;
  const [nombreAnimauxAcceptes, setNombreAnimauxAcceptes] = useState<number | null>(
    carcasse.type === CarcasseType.PETIT_GIBIER
      ? isLotRefuse
        ? 0 // Si le lot est refusé, 0 animaux acceptés
        : (nombreAnimauxAccepteFromDb ?? null)
      : null,
  );

  const submitCarcasseManquante = () => {
    setCarcasseManquante(true);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setCarcasseAcceptPartielCheckbox(false);
    setRefus('');
    const nextPartialCarcasseIntermediaire = {
      manquante: true,
      refus: null,
      prise_en_charge: false,
      ecarte_pour_inspection: false,
      check_manuel: false,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-manquante',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: true,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-manquante',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseRefus = (refusToRemember?: string) => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(true);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setCarcasseAcceptPartielCheckbox(false);
    // with custom value for InputForSearchPrefilledData, sometimes the user doesnt press on the blue tag to confirm the refus
    // so we need to get the value from the input directly
    const refusInputValue = (document.getElementsByName('carcasse-refus')?.[0] as HTMLInputElement)?.value;

    if (!refusToRemember && !refus && refus !== refusInputValue) {
      setRefus(refusInputValue);
    }
    if (!refusToRemember) refusToRemember = refus || refusInputValue;

    // Si c'est un petit gibier et que le lot est refusé, mettre automatiquement à 0 acceptés
    if (carcasse.type === CarcasseType.PETIT_GIBIER && nombreAnimauxTotal > 0) {
      setNombreAnimauxAcceptes(0);
    }

    // Utiliser 0 pour un refus de petit gibier, sinon null
    const nombreAcceptes = carcasse.type === CarcasseType.PETIT_GIBIER ? 0 : null;
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: refusToRemember,
      prise_en_charge: false,
      ecarte_pour_inspection: false,
      check_manuel: false,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
      nombre_d_animaux_acceptes: nombreAcceptes,
    };

    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-refus',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: refusToRemember,
      intermediaire_carcasse_refus_intermediaire_id: intermediaire.id,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-refus',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseEcarteePourInspection = () => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(true);
    setCarcasseAcceptPartielCheckbox(false);
    const nombreAcceptes = carcasse.type === CarcasseType.PETIT_GIBIER ? nombreAnimauxAcceptes : null;

    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: false,
      ecarte_pour_inspection: true,
      check_manuel: false,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
      nombre_d_animaux_acceptes: nombreAcceptes,
    };

    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-ecarte-pour-inspection',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-ecarte-pour-inspection',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseAccept = () => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setCarcasseAcceptPartielCheckbox(false);
    setRefus('');
    // Pour une acceptation complète, utiliser le nombre total d'animaux
    const nombreAcceptes = carcasse.type === CarcasseType.PETIT_GIBIER ? nombreAnimauxTotal : null;
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: true,
      ecarte_pour_inspection: false,
      check_manuel: true,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
      nombre_d_animaux_acceptes: nombreAcceptes,
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-accept',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-accept',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const submitCarcasseAcceptPartiel = () => {
    setCarcasseManquante(false);
    setCarcasseRefusCheckbox(false);
    setCarcasseEcarteePourInspectionCheckbox(false);
    setCarcasseAcceptPartielCheckbox(true);
    setRefus('');
    // Pour une acceptation partielle, utiliser la valeur saisie par l'utilisateur
    const nombreAcceptes = nombreAnimauxAcceptes ?? 0;
    const nextPartialCarcasseIntermediaire = {
      manquante: false,
      refus: null,
      prise_en_charge: true,
      ecarte_pour_inspection: false,
      check_manuel: true,
      decision_at: dayjs().toDate(),
      commentaire,
      intermediaire_poids: poids ? Number(poids) : null,
      nombre_d_animaux_acceptes: nombreAcceptes,
    };
    updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-intermediaire-accept-partiel',
      history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
    const nextPartialCarcasse: Partial<Carcasse> = {
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_motif: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      latest_intermediaire_signed_at: dayjs().toDate(),
    };
    updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse, true);
    addLog({
      user_id: user.id,
      user_role: intermediaire.intermediaire_role! as UserRoles, // ETG or COLLECTEUR_PRO
      fei_numero: fei.numero,
      action: 'carcasse-accept-partiel',
      history: createHistoryInput(carcasse, nextPartialCarcasse),
      entity_id: intermediaire.intermediaire_entity_id,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      intermediaire_id: intermediaire.id,
      carcasse_intermediaire_id: carcasseIntermediaireId,
    });
  };

  const updateNombreAnimauxAcceptes = (nouveauNombre: number | null) => {
    if (!canEdit) return;

    // Mettre à jour l'état local
    setNombreAnimauxAcceptes(nouveauNombre);

    // Sauvegarder automatiquement si c'est une acceptation partielle ou un refus
    if (carcasseAcceptPartielCheckbox || carcasseRefusCheckbox) {
      const nombreAcceptes = nouveauNombre ?? 0;
      const nextPartialCarcasseIntermediaire = {
        nombre_d_animaux_acceptes: nombreAcceptes,
      };
      updateCarcasseIntermediaire(carcasseIntermediaireId, nextPartialCarcasseIntermediaire);
      addLog({
        user_id: user.id,
        user_role: intermediaire.intermediaire_role! as UserRoles,
        fei_numero: fei.numero,
        action: 'carcasse-intermediaire-nombre-animaux-acceptes-update',
        history: createHistoryInput(carcasseIntermediaire, nextPartialCarcasseIntermediaire),
        entity_id: intermediaire.intermediaire_entity_id,
        zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
        intermediaire_id: intermediaire.id,
        carcasse_intermediaire_id: carcasseIntermediaireId,
      });
    }
  };

  let commentaireHint = [];
  if (carcasseManquante) {
    commentaireHint.push(`Un commentaire à ajouter\u00A0?`);
  } else {
    commentaireHint.push(
      `Un commentaire à ajouter\u00A0? Une carcasse retirée d'un lot de petit gibier\u00A0? Indiquez le ici et précisez-en les motifs le cas échéant.`,
    );
  }
  if (commentairesIntermediaires.length) {
    commentaireHint.push(``);
    commentaireHint.push(`Commentaires des autres intermédiaires :`);
    commentairesIntermediaires.forEach((commentaire) => {
      commentaireHint.push(`- ${commentaire}`);
    });
  }

  return (
    <>
      <CardCarcasse
        carcasse={carcasse}
        forceRefus={!!refus}
        forceManquante={!!carcasseManquante}
        forceAccept={!!carcasseIntermediaire.check_manuel}
        onClick={canEdit ? () => refusIntermediaireModal.open() : undefined}
        className="[zoom:1.3] [&_.text-manquante]:text-gray-500! [&.border-manquante]:border-gray-500!"
      />
      {canEdit && (
        <refusIntermediaireModal.Component
          title={
            <>
              {carcasse.espece} - N° {carcasse.numero_bracelet}
              <br />
              {commentairesIntermediaires.map((commentaire, index) => {
                return (
                  <p key={commentaire + index} className="mt-2 block text-sm font-normal opacity-70">
                    {commentaire}
                  </p>
                );
              })}
              {!!carcasse.examinateur_anomalies_abats?.length && (
                <p className="mt-2 text-sm">
                  Anomalies abats:
                  <br />
                  {carcasse.examinateur_anomalies_abats.map((anomalie) => {
                    return (
                      <span className="m-0 ml-2 block font-normal opacity-70" key={anomalie}>
                        {anomalie}
                      </span>
                    );
                  })}
                </p>
              )}
              {!!carcasse.examinateur_anomalies_carcasse?.length && (
                <p className="mt-2 text-sm">
                  Anomalies carcasse:
                  <br />
                  {carcasse.examinateur_anomalies_carcasse.map((anomalie) => {
                    return (
                      <span className="m-0 ml-2 block font-normal opacity-70" key={anomalie}>
                        {anomalie}
                      </span>
                    );
                  })}
                </p>
              )}
            </>
          }
        >
          {isRefusIntermediaireModalOpen && (
            <form
              method="POST"
              ref={formRef}
              onSubmit={(e) => e.preventDefault()}
              id={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            >
              <div className="mt-4">
                {/* cutsom radio buttons en reprenant le code de @codegouvfr/react-dsfr/RadioButtons pour y insérer un input pour le nombre d'animaux acceptés */}
                <fieldset className="fr-fieldset">
                  <div className="fr-fieldset__content">
                    {/* Radio: Lot accepté / Carcasse acceptée */}
                    <div className="fr-radio-group">
                      <input
                        type="radio"
                        id="carcasse-status-accept"
                        name="carcasse-status"
                        required
                        checked={
                          !carcasseRefusCheckbox &&
                          !carcasseManquante &&
                          !carcasseAcceptPartielCheckbox &&
                          !carcasseEcarteePourInspectionCheckbox &&
                          !!carcasseIntermediaire.check_manuel &&
                          !carcasseIntermediaire.refus &&
                          !carcasse.intermediaire_carcasse_manquante &&
                          (carcasse.type === CarcasseType.PETIT_GIBIER
                            ? carcasseIntermediaire.nombre_d_animaux_acceptes === nombreAnimauxTotal
                            : true)
                        }
                        onChange={() => {
                          refusIntermediaireModal.close();
                          submitCarcasseAccept();
                        }}
                        disabled={!canEdit}
                      />
                      <label className="fr-label" htmlFor="carcasse-status-accept">
                        {carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse acceptée' : 'Lot accepté'}
                      </label>
                    </div>

                    {/* Radio: Lot partiellement accepté (uniquement pour petit gibier) */}
                    {carcasse.type === CarcasseType.PETIT_GIBIER && (
                      <>
                        <div className="fr-radio-group">
                          <input
                            type="radio"
                            id="carcasse-status-accept-partiel"
                            name="carcasse-status"
                            required
                            checked={!!carcasseAcceptPartielCheckbox && !carcasseManquante}
                            onChange={() => {
                              submitCarcasseAcceptPartiel();
                            }}
                            disabled={!canEdit}
                          />
                          <label className="fr-label" htmlFor="carcasse-status-accept-partiel">
                            Lot partiellement accepté
                          </label>
                        </div>
                        {/* Input pour le nombre d'animaux acceptés - affiché uniquement si "Lot partiellement accepté" est sélectionné */}
                        {carcasseAcceptPartielCheckbox && !carcasseManquante && (
                          <div className="mb-4 ml-8">
                            <Input
                              label="Nombre d'animaux acceptés"
                              hintText={`Nombre total d'animaux dans le lot : ${nombreAnimauxTotal}`}
                              nativeInputProps={{
                                type: 'number',
                                min: 0,
                                max: nombreAnimauxTotal,
                                name: Prisma.CarcasseIntermediaireScalarFieldEnum.nombre_d_animaux_acceptes,
                                form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                                value: nombreAnimauxAcceptes ?? '',
                                disabled: !canEdit || carcasseManquante,
                                onChange: (e) => {
                                  const rawValue = e.currentTarget.value;
                                  if (rawValue === '') {
                                    updateNombreAnimauxAcceptes(null);
                                    return;
                                  }
                                  const numValue = Number(rawValue);
                                  // Clamp value between 0 and nombreAnimauxTotal
                                  const clampedValue = Math.max(0, Math.min(numValue, nombreAnimauxTotal));
                                  updateNombreAnimauxAcceptes(clampedValue);
                                },
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Radio: Lot refusé / Carcasse refusée */}
                    <>
                      <div className="fr-radio-group">
                        <input
                          type="radio"
                          id="carcasse-status-refus"
                          name="carcasse-status"
                          required
                          checked={
                            (!!carcasseRefusCheckbox || !!carcasseIntermediaire.refus) &&
                            !carcasseManquante &&
                            !carcasseAcceptPartielCheckbox &&
                            !carcasseEcarteePourInspectionCheckbox
                          }
                          onChange={() => {
                            setCarcasseManquante(false);
                            setCarcasseRefusCheckbox(true);
                            setCarcasseEcarteePourInspectionCheckbox(false);
                            setCarcasseAcceptPartielCheckbox(false);
                            // Mettre automatiquement 0 animaux acceptés pour un refus de petit gibier
                            if (carcasse.type === CarcasseType.PETIT_GIBIER && nombreAnimauxTotal > 0) {
                              setNombreAnimauxAcceptes(0);
                              updateNombreAnimauxAcceptes(0);
                            }
                          }}
                          disabled={!canEdit}
                        />
                        <label className="fr-label" htmlFor="carcasse-status-refus">
                          {carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse refusée' : 'Lot refusé'}
                        </label>
                        {carcasse.type === CarcasseType.PETIT_GIBIER && (
                          <p className="fr-hint-text">
                            Si vous refusez seulement quelques animaux, utilisez plutôt l'option "Lot
                            partiellement accepté"
                          </p>
                        )}
                      </div>
                      {!!carcasseRefusCheckbox && (
                        <div className="mb-4">
                          <InputMultiSelect
                            label="Motif de refus *"
                            isMulti={false}
                            canEdit
                            data={refusIntermedaire[carcasse.type || CarcasseType.GROS_GIBIER]}
                            placeholder="Tapez un motif de refus"
                            onChange={([refus]) => {
                              setRefus(refus);
                              submitCarcasseRefus(refus);
                            }}
                            values={[refus]}
                            creatable
                          />
                        </div>
                      )}
                    </>

                    {/* Radio: Lot écarté pour inspection (uniquement pour ETG) */}
                    {user.roles.includes(UserRoles.ETG) && (
                      <div className="fr-radio-group">
                        <input
                          type="radio"
                          id="carcasse-status-ecarte-inspection"
                          name="carcasse-status"
                          required
                          checked={!!carcasseEcarteePourInspectionCheckbox && !carcasseManquante}
                          onChange={() => {
                            refusIntermediaireModal.close();
                            submitCarcasseEcarteePourInspection();
                          }}
                          disabled={!canEdit}
                        />
                        <label className="fr-label" htmlFor="carcasse-status-ecarte-inspection">
                          {carcasse.type === CarcasseType.GROS_GIBIER
                            ? 'Carcasse en peau écartée pour avis du SVI'
                            : 'Lot en plume écarté pour avis du SVI'}
                        </label>
                        {carcasse.type === CarcasseType.PETIT_GIBIER && (
                          <p className="fr-hint-text">
                            Si vous écartez seulement quelques animaux, ne cochez pas cette case, précisez le
                            nombre d'animaux écartés pour inspection dans le commentaire
                          </p>
                        )}
                      </div>
                    )}

                    {/* Radio: Lot manquant / Carcasse manquante */}
                    <div className="fr-radio-group">
                      <input
                        type="radio"
                        id="carcasse-status-manquante"
                        name="carcasse-status"
                        required
                        checked={carcasseManquante && !refus}
                        onChange={() => {
                          refusIntermediaireModal.close();
                          submitCarcasseManquante();
                        }}
                        disabled={!canEdit}
                      />
                      <label className="fr-label" htmlFor="carcasse-status-manquante">
                        {carcasse.type === CarcasseType.GROS_GIBIER ? 'Carcasse manquante' : 'Lot manquant'}
                      </label>
                    </div>
                  </div>
                </fieldset>
              </div>

              <Input
                label="Poids"
                hintText="En kg, facultatif"
                nativeInputProps={{
                  type: 'number',
                  min: 0,
                  name: Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids,
                  form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                  value: poids || '',
                  onChange: (e) => {
                    if (!canEdit) return;
                    setPoids(e.currentTarget.value);
                  },
                }}
              />

              <Input
                label="Votre commentaire"
                className="mt-2"
                hintText={
                  <>
                    {commentaireHint.map((sentence) => (
                      <Fragment key={sentence}>
                        {sentence}
                        <br />
                      </Fragment>
                    ))}
                  </>
                }
                textArea
                nativeTextAreaProps={{
                  name: Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
                  form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                  defaultValue: carcasseIntermediaire.commentaire || '',
                  disabled: !canEdit,
                  onChange: (e) => {
                    if (!canEdit) return;
                    setCommentaire(e.currentTarget.value);
                  },
                }}
              />

              <div className="mt-8 flex flex-col items-start bg-white md:[&_ul]:min-w-96">
                <ButtonsGroup
                  buttons={
                    carcasseIntermediaire.refus
                      ? [
                          {
                            children: 'Enregistrer',
                            type: 'submit',
                            disabled: !canEdit,
                            nativeButtonProps: {
                              onClick: (e) => {
                                e.preventDefault();
                                refusIntermediaireModal.close();
                                submitCarcasseRefus();
                              },
                            },
                          },
                          {
                            children: 'Annuler',
                            priority: 'secondary',
                            type: 'button',
                            disabled: !canEdit,
                            nativeButtonProps: {
                              onClick: (e) => {
                                e.preventDefault();
                                refusIntermediaireModal.close();
                                submitCarcasseAccept();
                              },
                            },
                          },
                        ]
                      : carcasseAcceptPartielCheckbox
                        ? [
                            {
                              children: 'Enregistrer',
                              type: 'submit',
                              disabled:
                                !canEdit ||
                                nombreAnimauxAcceptes === null ||
                                nombreAnimauxAcceptes < 0 ||
                                nombreAnimauxAcceptes > nombreAnimauxTotal,
                              nativeButtonProps: {
                                onClick: (e) => {
                                  e.preventDefault();
                                  submitCarcasseAcceptPartiel();
                                  refusIntermediaireModal.close();
                                },
                              },
                            },
                            {
                              children: 'Annuler',
                              priority: 'secondary',
                              type: 'button',
                              disabled: !canEdit,
                              nativeButtonProps: {
                                onClick: (e) => {
                                  e.preventDefault();
                                  refusIntermediaireModal.close();
                                },
                              },
                            },
                          ]
                        : [
                            {
                              children: carcasseRefusCheckbox ? 'Refuser' : 'Enregistrer',
                              type: 'submit',
                              disabled: !canEdit,
                              nativeButtonProps: {
                                form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                                disabled: carcasseRefusCheckbox && !refus,
                                onClick: (e) => {
                                  e.preventDefault();
                                  if (carcasseRefusCheckbox) {
                                    submitCarcasseRefus();
                                  }
                                  refusIntermediaireModal.close();
                                },
                              },
                            },
                          ]
                  }
                />
              </div>
            </form>
          )}
        </refusIntermediaireModal.Component>
      )}
    </>
  );
}
