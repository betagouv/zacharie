import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CarcasseType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import CarcasseSVI from '../fei/svi-carcasse';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import InputNotEditable from '@app/components/InputNotEditable';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadFei } from '@app/utils/load-fei';
import { loadMyRelations } from '@app/utils/load-my-relations';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import PencilStrikeThrough from '@app/components/PencilStrikeThrough';
import { CarcasseIPM1 } from './ipm1';
import { CarcasseIPM2 } from './ipm2';
import CarcasseSVICertificats from './certificats';

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
    // if (fei.fei_current_owner_user_id !== user.id) {
    //   return false;
    // }
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
      <title>
        {`${carcasse.numero_bracelet} - ${carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot de carcasses de petit gibier' : 'Carcasse de grand gibier'}`}{' '}
        - Zacharie
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">
            {carcasse.numero_bracelet} - {carcasse.espece}
          </h1>
          <Breadcrumb
            className="[&_a]:!text-base"
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: 'Fiches',
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
                defaultExpanded
                label={
                  <>
                    Infos sur la chasse et{' '}
                    {carcasse.type === CarcasseType.PETIT_GIBIER ? 'le lot de carcasses' : 'la carcasse'}{' '}
                    <PencilStrikeThrough />
                  </>
                }
              >
                <>
                  <InputNotEditable
                    label="Espèce"
                    nativeInputProps={{
                      defaultValue: carcasse.espece!,
                    }}
                  />
                  <InputNotEditable
                    label="Dates clés"
                    textArea
                    nativeTextAreaProps={{
                      rows: 5,
                      defaultValue: [
                        `Date de mise à mort: ${dayjs(fei.date_mise_a_mort).format('dddd DD MMMM YYYY')}`,
                        `Heure de mise à mort de la première carcasse de la fiche: ${fei.heure_mise_a_mort_premiere_carcasse!}`,
                        carcasse.type === CarcasseType.GROS_GIBIER
                          ? `Heure d'éviscération de la dernière carcasse de la fiche: ${fei.heure_evisceration_derniere_carcasse!}`
                          : '',
                        `Date et heure de dépôt dans le CCG le cas échéant: ${fei.premier_detenteur_depot_type === 'CCG' ? dayjs(fei.premier_detenteur_date_depot_quelque_part).format('dddd DD MMMM YYYY à HH:mm') : 'N/A'}`,
                        `Date et heure de prise en charge par l'ETG: ${dayjs(intermediaires[intermediaires.length - 1].check_finished_at).format('dddd DD MMMM YYYY à HH:mm')}`,
                      ]
                        .filter(Boolean)
                        .join('\n'),
                    }}
                  />
                  {carcasse.type === CarcasseType.PETIT_GIBIER && (
                    <InputNotEditable
                      label="Nombre d'animaux initialement prélevés"
                      nativeInputProps={{
                        defaultValue: carcasse.nombre_d_animaux!,
                      }}
                    />
                  )}
                  <InputNotEditable
                    label="Commentaires des destinataires"
                    textArea
                    nativeTextAreaProps={{
                      rows: commentairesIntermediaires.length,
                      defaultValue: commentairesIntermediaires.join('\n'),
                    }}
                  />
                  <InputNotEditable
                    label="Examinateur Initial"
                    textArea
                    nativeTextAreaProps={{
                      rows: examinateurInitialInput.length,
                      defaultValue: examinateurInitialInput.join('\n'),
                    }}
                  />
                  <InputNotEditable
                    label="Premier Détenteur"
                    textArea
                    nativeTextAreaProps={{
                      rows: premierDetenteurInput.length,
                      defaultValue: premierDetenteurInput.join('\n'),
                    }}
                  />
                </>
              </Accordion>
              {canEdit && (
                <Accordion titleAs="h2" defaultExpanded={!carcasse.svi_ipm2_decision} label="Décision SVI">
                  <Accordion
                    titleAs="h3"
                    defaultExpanded={false}
                    label={`Inspection Post-Mortem 1 (IPM1)${carcasse.svi_ipm1_date ? ` - ${dayjs(carcasse.svi_ipm1_date).format('DD-MM-YYYY')}` : ''}`}
                  >
                    <CarcasseIPM1 canEdit={canEdit} />
                  </Accordion>
                  <Accordion
                    titleAs="h3"
                    defaultExpanded={false}
                    label={`Inspection Post-Mortem 2 (IPM2)${carcasse.svi_ipm2_date ? ` - ${dayjs(carcasse.svi_ipm2_date).format('DD-MM-YYYY')}` : ''}`}
                  >
                    <CarcasseIPM2 canEdit={canEdit} />
                  </Accordion>
                </Accordion>
              )}
              <Accordion
                titleAs="h2"
                defaultExpanded
                label={
                  <>
                    Résumé de la décision <PencilStrikeThrough />
                  </>
                }
              >
                <CarcasseSVI
                  carcasse={carcasse}
                  canEdit={false}
                  key={dayjs(carcasse.updated_at).toISOString()}
                />
              </Accordion>
              {user.roles.includes(UserRoles.SVI) && (
                <Accordion
                  titleAs="h2"
                  defaultExpanded
                  label={
                    <>
                      Certificats <PencilStrikeThrough />
                    </>
                  }
                >
                  <CarcasseSVICertificats />
                </Accordion>
              )}
              <div className="mt-4">
                <Button
                  nativeButtonProps={{
                    onClick: () => {
                      navigate(-1);
                    },
                  }}
                >
                  Retour
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
