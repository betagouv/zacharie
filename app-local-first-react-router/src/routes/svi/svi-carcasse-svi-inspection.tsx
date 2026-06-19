import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CarcasseType, EntityRelationType, IPM1Decision, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import CardCarcasseSvi from '@app/components/CardCarcasseSvi';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { Button } from '@codegouvfr/react-dsfr/Button';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import { CarcasseIPM1 } from '@app/routes/svi/svi-inspection-carcasse/ipm1';
import { CarcasseIPM2 } from '@app/routes/svi/svi-inspection-carcasse/ipm2';
import CarcasseSVICertificats from '@app/routes/svi/svi-inspection-carcasse/certificats';
import FEIDonneesDeChasse from '@app/components/DonneesDeChasse';
import Section from '@app/components/Section';
import ItemNotEditable from '@app/components/ItemNotEditable';
import {
  PendingModificationBanner,
  HistoriqueDesModifications,
} from '@app/components/CarcasseModificationRequest';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { getPendingModifRequest } from '@app/utils/modif-requests';

export default function SviInspectionCarcasseLoader() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useLoaderEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadData('svi-carcasse-svi-inspection')
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

function SviInspectionCarcasse() {
  const params = useParams();
  const navigate = useNavigate();
  const user = useUser((state) => state.user)!;
  const entities = useZustandStore((state) => state.entities);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id!];
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const carcassesIntermediaire of carcassesIntermediaires) {
      if (carcassesIntermediaire?.commentaire) {
        const intermediaireEntity = entities[carcassesIntermediaire.intermediaire_entity_id];
        commentaires.push(
          `${intermediaireEntity?.nom_d_usage}\u00A0: ${carcassesIntermediaire?.commentaire}`
        );
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities]);

  const isSviWorkingFor = useMemo(() => {
    if (carcasse.svi_entity_id) {
      if (user.roles.includes(UserRoles.SVI)) {
        const svi = entities[carcasse.svi_entity_id];
        if (svi?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          return true;
        }
      }
    }
    return false;
  }, [carcasse, user, entities]);

  const allModifRequests = useZustandStore(
    (state) => state.modifRequestsByCarcasseId[carcasse.zacharie_carcasse_id]
  );
  const pendingModifRequest = getPendingModifRequest(allModifRequests);

  const canEdit = useMemo(() => {
    // SVI ne peut pas inspecter une carcasse dont l'identité (numéro de marquage) ou la signature de
    // l'examen initial sont en attente d'approbation par l'examinateur initial. Blocage dur.
    if (pendingModifRequest) {
      return false;
    }
    if (isSviWorkingFor) {
      return true;
    }
    if (carcasse.current_owner_role !== UserRoles.SVI) {
      return false;
    }
    if (!user.roles.includes(UserRoles.SVI)) {
      return false;
    }
    return true;
  }, [carcasse, user, isSviWorkingFor, pendingModifRequest]);

  const initIMP1Open = useRef(!carcasse.svi_ipm1_decision);
  const initIMP2Open = useRef(
    carcasse.svi_ipm1_decision !== IPM1Decision.ACCEPTE && !carcasse.svi_ipm2_decision
  );

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
          <PendingModificationBanner carcasse={carcasse} />
          <Breadcrumb
            className="[&_a]:text-base!"
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: 'Fiches',
                linkProps: {
                  to: '/app/svi',
                  href: '#',
                },
              },
              {
                label: fei.numero,
                linkProps: {
                  to: `/app/svi/fei/${fei.numero}`,
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
          {(allModifRequests?.length ?? 0) > 0 && (
            <Section
              title="Historique des modifications"
              open={false}
            >
              <HistoriqueDesModifications carcasse={carcasse} />
            </Section>
          )}
          <Section title="Résumé de la décision">
            <CardCarcasseSvi
              carcasse={carcasse}
              canClick={false}
              key={dayjs(carcasse.updated_at).toISOString()}
            />
          </Section>
          {(canEdit || pendingModifRequest) && (
            <>
              <Section
                open={initIMP1Open.current}
                title={`Inspection Post-Mortem 1 (IPM1)${carcasse.svi_ipm1_date ? ` - ${dayjs(carcasse.svi_ipm1_date).format('DD-MM-YYYY')}` : ''}`}
              >
                {pendingModifRequest ? (
                  <p className="m-0">
                    Tant que l'examinateur initial n'a pas fait approuvé la mise sur le marché, il est
                    impossible de réaliser les inspections post-mortem.
                  </p>
                ) : (
                  <CarcasseIPM1 canEdit={canEdit} />
                )}
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
                  {pendingModifRequest ? (
                    <p className="m-0">
                      Tant que l'examinateur initial n'a pas fait approuvé la mise sur le marché, il est
                      impossible de réaliser les inspections post-mortem.
                    </p>
                  ) : (
                    <CarcasseIPM2 canEdit={canEdit && carcasse.svi_ipm1_decision !== IPM1Decision.ACCEPTE} />
                  )}
                </div>
              </Section>
            </>
          )}

          {user.roles.includes(UserRoles.SVI) && (
            <Section title="Certificats">
              <CarcasseSVICertificats key={dayjs(carcasse.updated_at).toISOString()} />
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
