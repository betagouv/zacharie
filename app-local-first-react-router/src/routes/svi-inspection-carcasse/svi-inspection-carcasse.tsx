import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CarcasseType, EntityRelationType, IPM1Decision, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import CardCarcasseSvi from '@app/components/CardCarcasseSvi';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadFei } from '@app/utils/load-fei';
import { loadMyRelations } from '@app/utils/load-my-relations';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import { CarcasseIPM1 } from './ipm1';
import { CarcasseIPM2 } from './ipm2';
import CarcasseSVICertificats from './certificats';
import FEIDonneesDeChasse from '../fei/donnees-de-chasse';
import Section from '@app/components/Section';
import ItemNotEditable from '@app/components/ItemNotEditable';

export default function SviInspectionCarcasseLoader() {
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
  return <SviInspectionCarcasse key={fei.numero} />;
}

export function SviInspectionCarcasse() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const navigate = useNavigate();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const getCarcassesIntermediairesForCarcasse = useZustandStore(
    (state) => state.getCarcassesIntermediairesForCarcasse,
  );
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id!];
  const carcassesIntermediaires = getCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);
  const entities = useZustandStore((state) => state.entities);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const carcassesIntermediaire of carcassesIntermediaires) {
      if (carcassesIntermediaire?.commentaire) {
        const intermediaireEntity = entities[carcassesIntermediaire.intermediaire_entity_id];
        commentaires.push(
          `${intermediaireEntity?.nom_d_usage}\u00A0: ${carcassesIntermediaire?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities]);

  const isSviWorkingFor = useMemo(() => {
    // if (fei.fei_current_owner_role === UserRoles.SVI && !!fei.svi_entity_id) {
    // fix: pas besoin d'avoir pris en charge la fiche pour les SVI, elle est prise en charge automatiquement
    if (fei.svi_entity_id) {
      if (user.roles.includes(UserRoles.SVI)) {
        const svi = state.entities[fei.svi_entity_id];
        if (svi?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
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
    // if (fei.svi_closed_at) {
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

  const initIMP1Open = useRef(!carcasse.svi_ipm1_decision);
  const initIMP2Open = useRef(
    carcasse.svi_ipm1_decision !== IPM1Decision.ACCEPTE && !carcasse.svi_ipm2_decision,
  );

  console.log(carcasse.svi_ipm1_decision, canEdit && carcasse.svi_ipm1_decision !== IPM1Decision.ACCEPTE);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {`${carcasse.numero_bracelet} - ${carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot de carcasses de petit gibier' : 'Carcasse de grand gibier'} - Zacharie`}
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">
            {carcasse.numero_bracelet} - {carcasse.espece}
          </h1>
          <Breadcrumb
            className="[&_a]:text-base!"
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
          <Section
            title={`Infos sur la chasse et ${carcasse.type === CarcasseType.PETIT_GIBIER ? 'le lot de carcasses' : 'la carcasse'}`}
            open={false}
          >
            <>
              <FEIDonneesDeChasse carcasseId={carcasse.zacharie_carcasse_id} />
              {carcasse.type === CarcasseType.PETIT_GIBIER && (
                <ItemNotEditable
                  label="Nombre d'animaux initialement prélevés"
                  value={carcasse.nombre_d_animaux!.toString()}
                />
              )}
              <ItemNotEditable
                label="Commentaires des destinataires"
                value={commentairesIntermediaires.join('\n') || 'N/A'}
              />
            </>
          </Section>
          {canEdit && (
            <>
              <Section
                open={initIMP1Open.current}
                title={`Inspection Post-Mortem 1 (IPM1)${carcasse.svi_ipm1_date ? ` - ${dayjs(carcasse.svi_ipm1_date).format('DD-MM-YYYY')}` : ''}`}
              >
                <CarcasseIPM1 canEdit={canEdit} />
              </Section>
              <Section
                open={initIMP2Open.current}
                key={dayjs(carcasse.svi_ipm1_date || undefined).toISOString()}
                title={`Inspection Post-Mortem 2 (IPM2)${carcasse.svi_ipm2_date ? ` - ${dayjs(carcasse.svi_ipm2_date).format('DD-MM-YYYY')}` : ''}`}
                className={
                  carcasse.svi_ipm1_decision === IPM1Decision.ACCEPTE ? '[&_summary]:opacity-50' : ''
                }
              >
                <div>
                  {/* <CarcasseIPM2 canEdit={canEdit && carcasse.svi_ipm1_decision !== IPM1Decision.ACCEPTE} /> */}
                  <CarcasseIPM2 canEdit={false} />
                </div>
              </Section>
            </>
          )}

          <Section title="Résumé de la décision">
            <CardCarcasseSvi
              carcasse={carcasse}
              canClick={false}
              key={dayjs(carcasse.updated_at).toISOString()}
            />
          </Section>

          {user.roles.includes(UserRoles.SVI) && (
            <Section title="Certificats">
              <CarcasseSVICertificats
                key={
                  dayjs(carcasse.svi_ipm1_date || undefined).toISOString() +
                  dayjs(carcasse.svi_ipm2_date || undefined).toISOString()
                }
              />
            </Section>
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
  );
}
