import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, CarcasseType, UserRoles } from '@prisma/client';
import saisieSviList from '@app/data/saisie-svi/list.json';
import saisieSviTree from '@app/data/saisie-svi/tree.json';
import dayjs from 'dayjs';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import InputForSearchPrefilledData from '@app/components/InputForSearchPrefilledData';
import CarcasseSVI from './fei/svi-carcasse';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import InputNotEditable from '@app/components/InputNotEditable';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import ModalTreeDisplay from '@app/components/ModalTreeDisplay';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadFei } from '@app/utils/load-fei';
import { loadMyRelations } from '@app/utils/load-my-relations';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import { createHistoryInput } from '@app/utils/create-history-entry';
import PencilStrikeThrough from '@app/components/PencilStrikeThrough';

const saisieCarcasseModal = createModal({
  isOpenedByDefault: false,
  id: 'saisie-carcasse-modal',
});

export default function CarcasseSviLoader() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refreshUser('connexion')
      .then(loadMyRelations)
      .then(() => loadFei(params.fei_numero!))
      .then(() => {
        setHasTriedLoading(true);
      })
      .catch((error) => {
        setHasTriedLoading(true);
        console.error(error);
      });
  }, [params.fei_numero]);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <CarcasseEditSVI key={fei.numero} />;
}

export function CarcasseEditSVI() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const navigate = useNavigate();
  const fei = state.feis[params.fei_numero!];
  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? state.users[fei.examinateur_initial_user_id]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id
    ? state.users[fei.premier_detenteur_user_id]
    : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? state.entities[fei.premier_detenteur_entity_id]
    : null;
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);
  const updateCarcasse = state.updateCarcasse;
  const addLog = state.addLog;
  const carcasse = state.carcasses[params.zacharie_carcasse_id!];

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const intermediaire of intermediaires) {
      const carcassesIntermediairesId = getCarcasseIntermediaireId(
        fei.numero,
        carcasse.numero_bracelet,
        intermediaire.id,
      );
      const intermediaireCarcasse = state.carcassesIntermediaires[carcassesIntermediairesId];
      if (intermediaireCarcasse?.commentaire) {
        const intermediaireEntity = state.entities[intermediaire.fei_intermediaire_entity_id];
        commentaires.push(`${intermediaireEntity?.nom_d_usage} : ${intermediaireCarcasse?.commentaire}`);
      }
    }
    return commentaires;
  }, [carcasse.numero_bracelet, fei.numero, intermediaires, state.carcassesIntermediaires, state.entities]);

  const examinateurInitialInput = useMemo(() => {
    const lines = [];
    lines.push(`${examinateurInitialUser?.prenom} ${examinateurInitialUser?.nom_de_famille}`);
    lines.push(examinateurInitialUser?.telephone);
    lines.push(examinateurInitialUser?.email);
    lines.push(examinateurInitialUser?.numero_cfei);
    lines.push(`${examinateurInitialUser?.code_postal} ${examinateurInitialUser?.ville}`);
    return lines;
  }, [examinateurInitialUser]);

  const premierDetenteurInput = useMemo(() => {
    const lines = [];
    if (premierDetenteurEntity) {
      lines.push(premierDetenteurEntity.nom_d_usage);
      lines.push(premierDetenteurEntity.siret);
      lines.push(`${premierDetenteurEntity.code_postal} ${premierDetenteurEntity.ville}`);
      return lines;
    }
    lines.push(`${premierDetenteurUser?.prenom} ${premierDetenteurUser?.nom_de_famille}`);
    lines.push(premierDetenteurUser?.telephone);
    lines.push(premierDetenteurUser?.email);
    lines.push(premierDetenteurUser?.numero_cfei);
    lines.push(`${premierDetenteurUser?.code_postal} ${premierDetenteurUser?.ville}`);
    return lines;
  }, [premierDetenteurEntity, premierDetenteurUser]);

  const [motifsSaisie, setMotifsSaisie] = useState(
    carcasse?.svi_carcasse_saisie_motif?.filter(Boolean) ?? [],
  );
  const [typeSaisie, setTypeSaisie] = useState(carcasse?.svi_carcasse_saisie?.filter(Boolean) ?? []);

  const isSviWorkingFor = useMemo(() => {
    // if (fei.fei_current_owner_role === UserRoles.SVI && !!fei.svi_entity_id) {
    // fix: pas besoin d'avoir pris en charge la fiche pour les SVI, elle est prise en charge automatiquement
    if (fei.svi_entity_id) {
      if (user.roles.includes(UserRoles.SVI)) {
        const svi = state.entities[fei.svi_entity_id];
        if (svi?.relation === 'WORKING_FOR') {
          return true;
        }
      }
    }
    return false;
  }, [fei, user, state]);

  const canEdit = useMemo(() => {
    if (isSviWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    // if (fei.svi_signed_at) {
    //   return false;
    // }
    // if (fei.automatic_closed_at) {
    //   return false;
    // }
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      return false;
    }
    if (!user.roles.includes(UserRoles.SVI)) {
      return false;
    }
    return true;
  }, [fei, user, isSviWorkingFor]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">{carcasse.numero_bracelet}</h1>
          <p>
            {carcasse.type === CarcasseType.PETIT_GIBIER
              ? 'Lot de carcasses de petit gibier'
              : 'Carcasse de grand gibier'}
          </p>
          <Breadcrumb
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: 'Mon tableau de bord',
                linkProps: {
                  to: '/app/tableau-de-bord',
                  href: '#',
                },
              },
              {
                label: fei.numero,
                linkProps: {
                  to: `/app/tableau-de-bord/fei/${fei.numero}`,
                  href: '#',
                },
              },
            ]}
          />
          <div className="mb-6 bg-white py-2 md:shadow">
            <div className="p-4 pb-8 md:p-8 md:pb-4">
              <Accordion
                titleAs="h2"
                defaultExpanded={false}
                label={
                  <>
                    Infos sur la chasse et{' '}
                    {carcasse.type === CarcasseType.PETIT_GIBIER ? 'le lot de carcasses' : 'la carcasse'}{' '}
                    <PencilStrikeThrough />
                  </>
                }
              >
                <>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Espèce"
                      nativeInputProps={{
                        defaultValue: carcasse.espece!,
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Nombre d'animaux initialement prélevés"
                      nativeInputProps={{
                        defaultValue: carcasse.nombre_d_animaux!,
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Commentaires des destinataires"
                      textArea
                      nativeTextAreaProps={{
                        rows: commentairesIntermediaires.length,
                        defaultValue: commentairesIntermediaires.join('\n'),
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Examinateur Initial"
                      textArea
                      nativeTextAreaProps={{
                        rows: examinateurInitialInput.length,
                        defaultValue: examinateurInitialInput.join('\n'),
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Premier Détenteur"
                      textArea
                      nativeTextAreaProps={{
                        rows: premierDetenteurInput.length,
                        defaultValue: premierDetenteurInput.join('\n'),
                      }}
                    />
                  </div>
                </>
              </Accordion>
              {canEdit && (
                <Accordion titleAs="h2" defaultExpanded label="Saisie">
                  <form
                    method="POST"
                    id={`svi-carcasse-${carcasse.numero_bracelet}`}
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <div className="fr-fieldset__element">
                      <RadioButtons
                        legend="Décision carcasse"
                        options={[
                          {
                            nativeInputProps: {
                              required: true,
                              checked: typeSaisie.length === 0,
                              onChange: () => {
                                setTypeSaisie([]);
                                setMotifsSaisie([]);
                              },
                            },
                            label: 'Pas de saisie',
                          },
                          {
                            nativeInputProps: {
                              required: true,
                              checked: typeSaisie[0] === 'Saisie totale',
                              onChange: () => {
                                setTypeSaisie(['Saisie totale']);
                              },
                            },
                            label: 'Saisie totale',
                          },
                          {
                            nativeInputProps: {
                              required: true,
                              checked: typeSaisie[0] === 'Saisie partielle',
                              onChange: () => {
                                if (typeSaisie[0] !== 'Saisie partielle') {
                                  setMotifsSaisie([]);
                                }
                                setTypeSaisie(['Saisie partielle']);
                              },
                            },
                            label: 'Saisie partielle',
                          },
                        ]}
                      />
                    </div>
                    {carcasse.type === CarcasseType.PETIT_GIBIER &&
                      ['Saisie partielle', 'Saisie totale'].includes(typeSaisie[0]) && (
                        <div className="fr-fieldset__element">
                          <Input
                            label="Nombre de carcasses saisies *"
                            hintText={`Nombre d'animaux initialement prélevés\u00A0: ${carcasse.nombre_d_animaux}`}
                            nativeInputProps={{
                              type: 'number',
                              value: typeSaisie?.[1] ?? '',
                              // max: Number(carcasse.nombre_d_animaux),
                              onChange: (e) => {
                                setTypeSaisie([typeSaisie[0], e.target.value]);
                              },
                            }}
                          />
                        </div>
                      )}
                    {carcasse.type === CarcasseType.GROS_GIBIER && typeSaisie[0] === 'Saisie partielle' && (
                      <div className="fr-fieldset__element">
                        <Checkbox
                          legend="Saisie partielle"
                          options={[
                            'Coffre',
                            'Collier',
                            'Cuisse',
                            'Cuissot',
                            'Épaule',
                            'Gigot',
                            'Filet',
                            'Filet mignon',
                            'Poitrine',
                            'Quartier arrière',
                            'Quartier avant',
                          ].map((saisiePartielle) => {
                            return {
                              label: saisiePartielle,
                              nativeInputProps: {
                                checked: typeSaisie.includes(saisiePartielle),
                                onChange: (e) => {
                                  if (e.target.checked) {
                                    const nextTypeSaisie = [...typeSaisie, saisiePartielle];
                                    setTypeSaisie(nextTypeSaisie);
                                  } else {
                                    const nextTypeSaisie = typeSaisie.filter((s) => s !== saisiePartielle);
                                    setTypeSaisie(nextTypeSaisie);
                                  }
                                },
                              },
                            };
                          })}
                        />
                      </div>
                    )}
                    {typeSaisie.length > 0 && (
                      <>
                        <div className="fr-fieldset__element mt-4">
                          <InputForSearchPrefilledData
                            canEdit
                            data={saisieSviList[carcasse.type ?? CarcasseType.GROS_GIBIER]}
                            label="Motif de la saisie *"
                            hintText={
                              <button type="button" onClick={() => saisieCarcasseModal.open()}>
                                Voir le référentiel des saisies de carcasse en{' '}
                                <u className="inline">cliquant ici</u>
                              </button>
                            }
                            hideDataWhenNoSearch
                            clearInputOnClick
                            placeholder={
                              motifsSaisie.length
                                ? 'Commencez à taper un autre motif de saisie supplémentaire'
                                : 'Commencez à taper un motif de saisie'
                            }
                            onSelect={(newMotifSaisie) => {
                              const nextMotifsSaisie = [...motifsSaisie, newMotifSaisie];
                              setMotifsSaisie(nextMotifsSaisie);
                            }}
                          />
                          <ModalTreeDisplay
                            data={saisieSviTree[carcasse.type ?? CarcasseType.GROS_GIBIER]}
                            modal={saisieCarcasseModal}
                            title={`Motifs de saisie ${carcasse.type === CarcasseType.PETIT_GIBIER ? 'petit gibier' : 'gros gibier'}`}
                            onItemClick={(newMotifSaisie) => {
                              const nextMotifsSaisie = [...motifsSaisie, newMotifSaisie];
                              setMotifsSaisie(nextMotifsSaisie);
                            }}
                          />
                        </div>
                        {motifsSaisie.map((motif, index) => {
                          return (
                            <Notice
                              isClosable
                              key={motif + index}
                              title={motif}
                              onClose={() => {
                                const nextMotifsSaisie = motifsSaisie.filter(
                                  (motifSaisie) => motifSaisie !== motif,
                                );
                                setMotifsSaisie((motifsSaisie) => {
                                  return motifsSaisie.filter((motifSaisie) => motifSaisie !== motif);
                                });
                                let nextPartialCarcasse: Partial<typeof carcasse>;
                                if (nextMotifsSaisie.length) {
                                  nextPartialCarcasse = {
                                    svi_carcasse_saisie_motif: nextMotifsSaisie,
                                    svi_carcasse_saisie_at: dayjs().toDate(),
                                    svi_carcasse_signed_at: dayjs().toDate(),
                                  };
                                } else {
                                  nextPartialCarcasse = {
                                    svi_carcasse_saisie_motif: [],
                                    svi_carcasse_saisie_at: null,
                                    svi_carcasse_signed_at: dayjs().toDate(),
                                  };
                                }
                                updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                                addLog({
                                  user_id: user.id,
                                  user_role: UserRoles.SVI,
                                  fei_numero: fei.numero,
                                  action: 'svi-remove-one-saisie-motif',
                                  history: createHistoryInput(carcasse, nextPartialCarcasse),
                                  entity_id: fei.fei_current_owner_entity_id,
                                  zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                                  fei_intermediaire_id: null,
                                  carcasse_intermediaire_id: null,
                                });
                              }}
                            />
                          );
                        })}
                      </>
                    )}
                    <div className="fr-fieldset__element mt-4">
                      <Input
                        label="Commentaire"
                        hintText="Un commentaire à ajouter ?"
                        textArea
                        nativeTextAreaProps={{
                          name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
                          form: `svi-carcasse-${carcasse.numero_bracelet}`,
                          defaultValue: carcasse?.svi_carcasse_commentaire || '',
                          onBlur: (e) => {
                            const nextPartialCarcasse = {
                              svi_carcasse_commentaire: e.target.value,
                              svi_carcasse_signed_at: dayjs().toDate(),
                            };
                            updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                            addLog({
                              user_id: user.id,
                              user_role: UserRoles.SVI,
                              fei_numero: fei.numero,
                              action: 'svi-commentaire',
                              history: createHistoryInput(carcasse, nextPartialCarcasse),
                              entity_id: fei.fei_current_owner_entity_id,
                              zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                              fei_intermediaire_id: null,
                              carcasse_intermediaire_id: null,
                            });
                          },
                        }}
                      />
                    </div>
                    <div className="flex flex-col items-start bg-white pl-2 [&_ul]:md:min-w-96">
                      <ButtonsGroup
                        buttons={
                          !motifsSaisie.length
                            ? [
                                {
                                  children:
                                    typeSaisie.length === 0 ? 'Enregistrer et retour à la fiche' : 'Saisir',
                                  type: 'submit',
                                  nativeButtonProps: {
                                    form: `svi-carcasse-${carcasse.numero_bracelet}`,
                                    name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
                                    title:
                                      typeSaisie.length > 0 ? 'Vous devez remplir un motif de saisie' : '',
                                    disabled: typeSaisie.length > 0,
                                    onClick: (e) => {
                                      e.preventDefault();
                                      const nextPartialCarcasse = {
                                        svi_carcasse_saisie: typeSaisie,
                                        svi_carcasse_saisie_motif: motifsSaisie,
                                        svi_carcasse_saisie_at: dayjs().toDate(),
                                        svi_carcasse_signed_at: dayjs().toDate(),
                                      };
                                      updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                                      addLog({
                                        user_id: user.id,
                                        user_role: UserRoles.SVI,
                                        fei_numero: fei.numero,
                                        action: 'svi-enregistrer',
                                        history: createHistoryInput(carcasse, nextPartialCarcasse),
                                        entity_id: fei.fei_current_owner_entity_id,
                                        zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                                        fei_intermediaire_id: null,
                                        carcasse_intermediaire_id: null,
                                      });
                                      if (typeSaisie.length === 0) {
                                        navigate(`/app/tableau-de-bord/fei/${fei.numero}`);
                                      }
                                    },
                                    suppressHydrationWarning: true,
                                    value: dayjs().toISOString(),
                                  },
                                },
                              ]
                            : JSON.stringify(carcasse.svi_carcasse_saisie_motif) !==
                                JSON.stringify(motifsSaisie)
                              ? [
                                  {
                                    children: 'Saisir',
                                    type: 'submit',
                                    nativeButtonProps: {
                                      onClick: (e) => {
                                        if (!motifsSaisie.length) {
                                          e.preventDefault();
                                          alert('Veuillez ajouter au moins un motif de saisie');
                                          return;
                                        }
                                        const nextPartialCarcasse = {
                                          svi_carcasse_saisie: typeSaisie,
                                          svi_carcasse_saisie_motif: motifsSaisie,
                                          svi_carcasse_saisie_at: dayjs().toDate(),
                                          svi_carcasse_signed_at: dayjs().toDate(),
                                        };
                                        updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                                        addLog({
                                          user_id: user.id,
                                          user_role: UserRoles.SVI,
                                          fei_numero: fei.numero,
                                          action: 'svi-saisir',
                                          history: createHistoryInput(carcasse, nextPartialCarcasse),
                                          entity_id: fei.fei_current_owner_entity_id,
                                          zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                                          fei_intermediaire_id: null,
                                          carcasse_intermediaire_id: null,
                                        });
                                      },
                                      form: `svi-carcasse-${carcasse.numero_bracelet}`,
                                      name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
                                      suppressHydrationWarning: true,
                                      value: dayjs().toISOString(),
                                    },
                                  },
                                ]
                              : [
                                  {
                                    children: 'Annuler la saisie',
                                    priority: 'secondary',
                                    type: 'button',
                                    nativeButtonProps: {
                                      onClick: () => {
                                        setMotifsSaisie([]);
                                        setTypeSaisie([]);
                                        const nextPartialCarcasse = {
                                          svi_carcasse_saisie: [],
                                          svi_carcasse_saisie_motif: [],
                                          svi_carcasse_saisie_at: null,
                                          svi_carcasse_commentaire: null,
                                          svi_carcasse_signed_at: dayjs().toDate(),
                                        };
                                        updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                                        addLog({
                                          user_id: user.id,
                                          user_role: UserRoles.SVI,
                                          fei_numero: fei.numero,
                                          action: 'svi-annuler',
                                          history: createHistoryInput(carcasse, nextPartialCarcasse),
                                          entity_id: fei.fei_current_owner_entity_id,
                                          zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                                          fei_intermediaire_id: null,
                                          carcasse_intermediaire_id: null,
                                        });
                                      },
                                    },
                                  },
                                ]
                        }
                      />
                    </div>
                  </form>
                </Accordion>
              )}
              <Accordion
                titleAs="h2"
                defaultExpanded
                label={
                  <>
                    Résumé affiché dans la fiche <PencilStrikeThrough />
                  </>
                }
              >
                <CarcasseSVI
                  carcasse={carcasse}
                  canEdit={false}
                  key={dayjs(carcasse.updated_at).toISOString()}
                />
              </Accordion>
              <div className="fr-fieldset__element mt-4">
                <Button linkProps={{ to: `/app/tableau-de-bord/fei/${fei.numero}` }}>
                  Retour à la fiche
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
